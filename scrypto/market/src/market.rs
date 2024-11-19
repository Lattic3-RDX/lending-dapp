/* ------------------ Imports ----------------- */
// Usages
use crate::asset::AssetEntry;
use crate::cluster::{ClusterState, ClusterWrapper};
use crate::events::*;
use crate::position::Position;
use crate::utils::{trunc, ValueMap};
use scrypto::prelude::*;

/* ----------------- Blueprint ---------------- */
#[blueprint]
#[events(
    InstantiseEvent,
    // Position management
    OpenPositionEvent,
    PositionSupplyEvent,
    PositionBorrowEvent,
    PositionWithdrawEvent,
    PositionRepayEvent,
    PositionCloseEvent,
    // Internal position operations
    PositionHealthEvent,
    // Asset management
    AddAssetEvent,
    TrackAssetEvent,
    UntrackAssetEvent
)]
// Types registered to reduce fees; include those used for KV stores, structs, NFTs, etc.
#[types(Decimal, ResourceAddress, ComponentAddress, GlobalAddress, AssetEntry, Position)]
mod lattic3 {
    use indexmap::IndexSet;

    // Method roles
    enable_method_auth! {
        roles {
            admin => updatable_by: [OWNER];
        },
        methods {
            // Position management
            open_position     => PUBLIC;
            close_position    => restrict_to: [SELF];
            position_supply   => PUBLIC;
            position_borrow   => PUBLIC;
            position_withdraw => PUBLIC;
            position_repay    => PUBLIC;
            // Internal position operations
            get_position_health       => PUBLIC;
            calculate_position_health => PUBLIC;
            // Asset management
            add_asset     => restrict_to: [SELF, OWNER];
            track_asset   => restrict_to: [SELF, OWNER, admin];
            untrack_asset => restrict_to: [SELF, OWNER, admin];
            // Price stream management
            link_price_stream   => restrict_to: [SELF, OWNER];
            unlink_price_stream => restrict_to: [SELF, OWNER];
            // Utility methods
            log_asset_list => PUBLIC;
            log_assets     => PUBLIC;
        }
    }

    // Importing price stream blueprint
    extern_blueprint! {
        "package_sim1pkwaf2l9zkmake5h924229n44wp5pgckmpn0lvtucwers56awywems",
        PriceStream {
            fn get_price(&self, asset: ResourceAddress) -> Option<PreciseDecimal>;
        }
    }

    extern_blueprint! {
        "package_sim1pkwaf2l9zkmake5h924229n44wp5pgckmpn0lvtucwers56awywems",
        Cluster {
            fn instantiate(resource: ResourceAddress, cluster_owner_rule: AccessRule, cluster_admin_rule: AccessRule) -> Global<Cluster>;

            fn supply(&mut self, supply: Bucket) -> Bucket;
            fn withdraw(&mut self, units: Bucket) -> Bucket;
            fn borrow(&mut self, amount: PreciseDecimal) -> (Bucket, PreciseDecimal);
            fn repay(&mut self, repayment: Bucket) -> PreciseDecimal;

            fn get_supply_ratio(&self) -> PreciseDecimal;
            fn get_debt_ratio(&self) -> PreciseDecimal;
            fn get_cluster_state(&self) -> ClusterState;

            fn provide_liquidity(&mut self, provided: Bucket);

            fn tick_interest(&mut self);
            fn set_interest_tick_interval(&mut self, interval: i64);
        }
    }

    struct Lattic3 {
        component_address: ComponentAddress,

        owner_badge_address: ResourceAddress,
        admin_manager: ResourceManager,

        asset_list: IndexSet<ResourceAddress>, // List of all 'tracked' assets; serves as a filter out of all added assets
        assets: KeyValueStore<ResourceAddress, AssetEntry>,
        address_to_supply_unit: KeyValueStore<ResourceAddress, ResourceAddress>,
        supply_unit_to_address: KeyValueStore<ResourceAddress, ResourceAddress>,

        price_stream_address: Option<ComponentAddress>,

        position_manager: ResourceManager,
        position_id: u64,
    }

    impl Lattic3 {
        pub fn instantiate(dapp_definition_address: ComponentAddress, owner_badge: Bucket) -> (Global<Lattic3>, Bucket) {
            // Reserve address
            let (address_reservation, component_address) = Runtime::allocate_component_address(Lattic3::blueprint_id());

            //. Badges and rules
            // Component
            let component_access_rule: AccessRule = rule!(require(global_caller(component_address)));

            // Component owner
            // - let owner_badge: Bucket = ResourceBuilder::new_fungible(OwnerRole::None)
            // -     .divisibility(DIVISIBILITY_NONE)
            // -     .metadata(metadata! {init {
            // -         "name"        => "Lattic3 Owner Badge", locked;
            // -         "description" => "Badge representing the owner of the Lattic3 lending platform", locked;
            // -     }})
            // -     .mint_initial_supply(1)
            // -     .into();
            let owner_access_rule: AccessRule = rule!(require(owner_badge.resource_address()));
            let owner_role: OwnerRole = OwnerRole::Fixed(owner_access_rule.clone());

            // Admin badge
            // TODO: replace with non-fungible
            let admin_manager: ResourceManager = ResourceBuilder::new_fungible(owner_role.clone())
                .divisibility(DIVISIBILITY_NONE)
                .metadata(metadata! {init {
                    "name"        => "", locked;
                    "description" => "", locked;
                }})
                .mint_roles(mint_roles! {
                    minter         => component_access_rule.clone();
                    minter_updater => rule!(deny_all);
                })
                .recall_roles(recall_roles! {
                    recaller         => component_access_rule.clone();
                    recaller_updater => rule!(deny_all);
                })
                .burn_roles(burn_roles! {
                    burner         => component_access_rule.clone();
                    burner_updater => rule!(deny_all);
                })
                .create_with_no_initial_supply();
            let admin_access_rule: AccessRule = rule!(require(admin_manager.address()));

            // Position badge
            let position_manager: ResourceManager = ResourceBuilder::new_integer_non_fungible::<Position>(owner_role.clone())
                .metadata(metadata! {init {
                    "name"            => "Lattic3 Node", locked;
                    "description"     => "Badge representing a position in the Lattic3", locked;
                    "dapp_definition" => dapp_definition_address, updatable;
                }})
                .non_fungible_data_update_roles(non_fungible_data_update_roles! {
                    non_fungible_data_updater         => component_access_rule.clone();
                    non_fungible_data_updater_updater => rule!(deny_all);
                })
                .mint_roles(mint_roles! {
                    minter         => component_access_rule.clone();
                    minter_updater => rule!(deny_all);
                })
                .burn_roles(burn_roles! {
                    burner         => component_access_rule.clone();
                    burner_updater => rule!(deny_all);
                })
                .create_with_no_initial_supply();

            //. Internal data setup
            // Initialise component data
            let component_data: Lattic3 = Self {
                component_address,
                owner_badge_address: owner_badge.resource_address(),
                admin_manager,
                asset_list: IndexSet::new(),
                assets: KeyValueStore::new(),
                address_to_supply_unit: KeyValueStore::new(),
                supply_unit_to_address: KeyValueStore::new(),
                price_stream_address: None,
                position_manager,
                position_id: 0u64,
            };

            //. Component
            let asset_list = component_data.asset_list.clone();

            // Metadata
            let component_metadata = metadata! {
                roles {
                    metadata_setter         => OWNER;
                    metadata_setter_updater => OWNER;
                    metadata_locker         => OWNER;
                    metadata_locker_updater => rule!(deny_all);
                },
                init {
                    "name"            => "Lattic3 Lending Platform", locked;
                    "description"     => "Multi-collateralized lending platform", locked;
                    "dapp_definition" => dapp_definition_address, updatable;
                }
            };

            // Roles
            let component_roles = roles! {
                admin => admin_access_rule.clone();
            };

            // Instantisation
            let component: Global<Lattic3> = component_data
                .instantiate()
                .prepare_to_globalize(owner_role)
                .roles(component_roles)
                .metadata(component_metadata)
                .with_address(address_reservation)
                .globalize();

            // Call instantisation event
            Runtime::emit_event(InstantiseEvent { component_address: component.address(), asset_list });

            // Return
            (component, owner_badge)
        }

        //. ------------ Position Management ----------- /
        // Operations
        pub fn open_position(&mut self, supply: Vec<Bucket>) -> (Bucket, Vec<Bucket>) {
            // Sanity checks
            self.validate_buckets(&supply);
            assert!(self.position_id != u64::MAX, "Cannot open more positions");

            // Initialise empty position
            let mut position = Position::new();

            // Supply resources to clusters
            let mut supply_units: Vec<Bucket> = Vec::new();
            for bucket in supply {
                let mut asset = self.assets.get_mut(&bucket.resource_address()).expect("Cannot get asset entry");

                let pool_unit = asset.cluster_wrapper.cluster.supply(bucket);
                supply_units.push(pool_unit);
            }

            let unit_map = self.buckets_to_value_map(&supply_units);
            position.update_supply(&unit_map);

            // Mint and return position NFT
            self.position_id += 1;
            let position_badge = self.position_manager.mint_non_fungible(&NonFungibleLocalId::Integer(self.position_id.into()), position);

            // Fire open position event
            Runtime::emit_event(OpenPositionEvent {
                position_id: NonFungibleLocalId::Integer(self.position_id.into()),
                supply: unit_map,
            });
            info!("[open_position] Position event");

            // Return
            (position_badge, supply_units)
        }

        pub fn close_position(&mut self, position_bucket: NonFungibleBucket) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            // Burn the nft
            position_bucket.burn();

            // Fire position close event
            Runtime::emit_event(PositionCloseEvent {});
        }

        pub fn position_supply(&mut self, position_bucket: NonFungibleBucket, supply: Vec<Bucket>) -> (NonFungibleBucket, Vec<Bucket>) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");
            self.validate_buckets(&supply);

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let mut position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_supply] Position: {:#?}", position);

            // Supply resources to clusters
            let supply_map = self.buckets_to_value_map(&supply);

            let mut supply_units: Vec<Bucket> = Vec::new();
            for bucket in supply {
                let mut asset = self.assets.get_mut(&bucket.resource_address()).expect("Cannot get asset entry");

                let pool_unit = asset.cluster_wrapper.cluster.supply(bucket);
                supply_units.push(pool_unit);
            }

            let unit_map = self.buckets_to_value_map(&supply_units);
            position.update_supply(&unit_map);

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "supply", position.supply);

            // Fire position supply event
            Runtime::emit_event(PositionSupplyEvent { position_id: local_id, supply: supply_map, supply_units: unit_map });

            // Return
            (position_bucket, supply_units)
        }

        pub fn position_borrow(&mut self, position_bucket: NonFungibleBucket, debt: ValueMap) -> (NonFungibleBucket, Vec<Bucket>) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            for (address, amount) in &debt {
                assert!(amount > &pdec!(0.0), "Borrow amount must be greater than 0");
                assert!(self.validate_fungible(*address), "Asset with address {:?} is invalid", address);
            }

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let mut position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_borrow] Position: {:#?}", position);

            // Borrow from clusters
            let mut borrowed: Vec<Bucket> = Vec::new();
            let mut debt_units: ValueMap = ValueMap::new();
            for (&address, &amount) in &debt {
                let mut asset = self.assets.get_mut(&address).expect("Cannot get asset entry");

                let (debt, debt_unit) = asset.cluster_wrapper.cluster.borrow(amount);
                borrowed.push(debt);
                debt_units.insert(address, debt_unit);
            }

            position.update_debt(&debt_units);

            // Ensure that operation won't put position health below 1.0
            let health = self.calculate_position_health(position.supply, position.debt.clone());
            assert!(health >= pdec!(1.0), "Position health will be below 1.0. Reverting operation");

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "debt", position.debt);

            // Fire position borrow event
            Runtime::emit_event(PositionBorrowEvent { position_id: local_id, debt, debt_units });

            // Return borrowed resources
            (position_bucket, borrowed)
        }

        pub fn position_withdraw(&mut self, position_bucket: NonFungibleBucket, pool_units: Bucket) -> (Option<NonFungibleBucket>, Bucket) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            let pool_unit_address = pool_units.resource_address();
            let provided: PreciseDecimal = pool_units.amount().into();
            assert!(!pool_units.is_empty(), "Bucket for {:?} is empty", pool_unit_address);
            assert!(self.supply_unit_to_address.get(&pool_unit_address).is_some(), "Address not found for pool unit {:?}", pool_unit_address);

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_withdraw] Position: {:#?}", position);

            // Get pool unit's source asset
            let address = *self
                .supply_unit_to_address
                .get(&pool_unit_address)
                .expect(format!("Cannot get address for pool unit {:?}", pool_unit_address).as_str());

            // Recalculate supply
            let supplied = *position.supply.get(&address).expect(format!("Cannot get supplied amount for asset {:?}", address).as_str());
            let supply_amount = supplied.checked_sub(self.get_redemption_value(pool_unit_address, provided)).unwrap();
            info!("[position_withdraw] Supplied: {}", supplied);
            info!("[position_withdraw] Supply amount: {}", supply_amount);

            let mut new_supply = position.supply;
            if supply_amount > pdec!(0.0) {
                new_supply.insert(address, supply_amount);
            } else {
                new_supply.remove(&address);
            }

            // Ensure that operation won't put position health below 1.0
            let health = self.calculate_position_health(new_supply.clone(), position.debt.clone());
            assert!(health >= pdec!(1.0), "Position health will be below 1.0. Reverting operation");

            // Execute withdrawal
            let withdrawn = self.redeem(pool_units);

            // Fire position withdraw event
            Runtime::emit_event(PositionWithdrawEvent {
                position_id: local_id.clone(),
                supply_unit: (pool_unit_address, provided),
                supply: new_supply.clone(),
                withdraw: (address, withdrawn.amount().into()),
            });

            // Update NFT data or burn if empty
            if new_supply.is_empty() && position.debt.is_empty() {
                self.close_position(position_bucket);
                return (None, withdrawn);
            }

            self.position_manager.update_non_fungible_data(&local_id, "supply", new_supply);

            (Some(position_bucket), withdrawn)
        }

        pub fn position_repay(&mut self, position_bucket: NonFungibleBucket, mut debt: Bucket) -> (Option<NonFungibleBucket>, Bucket) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_repay] Position: {:#?}", position);

            let address = debt.resource_address();
            let amount: PreciseDecimal = debt.amount().into();

            // Ensure repayment is valid
            assert!(!debt.is_empty(), "Bucket for {:?} is empty", address);
            assert!(position.debt.contains_key(&address), "Asset {:?} not borrowed", address);

            // Fetch asset entry
            let mut asset = self.assets.get_mut(&address).expect("Cannot get asset entry");

            // Fire position repay event
            Runtime::emit_event(PositionRepayEvent { position_id: local_id.clone(), repay: (address, amount), debt: new_debt.clone() });

            // Update NFT data or burn if empty
            if position.supply.is_empty() && new_debt.is_empty() {
                self.close_position(position_bucket);
                return (None, debt);
            }

            self.position_manager.update_non_fungible_data(&local_id, "debt", new_debt);

            (Some(position_bucket), debt)
        }

        // Internal position methods
        pub fn get_position_health(&self, position_proof: NonFungibleProof) -> PreciseDecimal {
            // Sanity checks
            let position: Position = position_proof
                .check_with_message(self.position_manager.address(), "Position check failed")
                .non_fungible::<Position>()
                .data();
            info!("[get_position_health] Position: {:#?}", position);

            let health = self.calculate_position_health(position.supply, position.debt);

            health
        }

        pub fn calculate_position_health(&self, supply: ValueMap, debt: ValueMap) -> PreciseDecimal {
            // Return 'infinity' if no debt taken out
            if debt.is_empty() {
                info!("[calculate_position_health] Health: Infinity {:?}", PreciseDecimal::MAX);

                Runtime::emit_event(PositionHealthEvent { health: PreciseDecimal::MAX });
                return PreciseDecimal::MAX;
            }

            // Calculate supply value
            let (supply_value, _) = self.get_asset_values(&supply);
            info!("[calculate_position_health] Supply value: {}", supply_value);

            // Calculate debt value
            let (debt_value, _) = self.get_asset_values(&debt);
            info!("[calculate_position_health] Debt value: {}", debt_value);

            // Sanity check
            assert!(debt_value > pdec!(0.0), "Debt value must be greater than 0, I don't know how we got here. Debt: {:?}", debt);

            // health = (supply / debt), * 100 for display
            let health = supply_value.checked_div(debt_value).unwrap();
            info!("[calculate_position_health] Health: {:?}", health);

            // Fire health event
            Runtime::emit_event(PositionHealthEvent { health });

            health
        }

        //. --------------- Asset Listing -------------- /
        /// Add a fungible asset into the market, and output a FungibleAsset struct
        pub fn add_asset(&mut self, address: ResourceAddress) {
            info!("[add_asset] Adding asset: {:?}", address);

            // Sanity checks
            assert!(address.is_fungible(), "Provided asset must be fungible.");
            assert!(self.assets.get(&address).is_none(), "Asset already has an entry");
            assert!(!self.validate_fungible(address), "Cannot add asset {:?}, as it is already added and tracked", address);

            // Cluster owned: Lattic3 owner
            // Cluster admin: Lattic3 owner or Lattic3 market component calls
            let cluster_owner = rule!(require(self.owner_badge_address));
            let cluster_manager = rule!(require(global_caller(self.component_address)) || require(self.owner_badge_address));
            let cluster_wrapper = ClusterWrapper::create(address, cluster_owner, cluster_manager);

            // Create FungibleAsset
            let asset = AssetEntry::new(address, cluster_wrapper);
            info!("[add_asset] FungibleAsset: {:#?}", asset);

            // Fire AddAssetEvent
            Runtime::emit_event(AddAssetEvent {
                asset: address,
                cluster_address: asset.cluster_wrapper.cluster.address(),
                supply_unit_address: asset.cluster_wrapper.supply_unit,
            });

            self.assets.insert(address, asset.clone());
            self.address_to_supply_unit.insert(address, asset.cluster_wrapper.supply_unit);
            self.supply_unit_to_address.insert(asset.cluster_wrapper.supply_unit, address);
            self.track_asset(address);
        }

        /// Add an asset into the asset list
        pub fn track_asset(&mut self, asset: ResourceAddress) {
            info!("[track_asset] Tracking asset {:?}", asset);

            // Sanity checks
            assert!(!self.validate_fungible(asset), "Cannot add asset {:?}, as it is already added and tracked", asset);
            assert!(asset.is_fungible(), "Provided asset must be fungible.");
            assert!(self.assets.get(&asset).is_some(), "No asset entry for {:?}, run add_asset first", asset);
            // assert!(self.pools.get(&asset).is_some(), "No pool for asset {:?}, run add_asset first", asset);

            // Append the asset into the asset list
            self.asset_list.append(asset);
        }

        /// Removes an asset from the asset list
        pub fn untrack_asset(&mut self, asset: ResourceAddress) {
            info!("[untrack_asset] Removing asset: {:?}", asset);

            // Sanity checks
            assert!(self.validate_fungible(asset), "Asset with address {:?} is invalid", asset);

            // Remove asset
            let found = self.asset_list.find(&asset);
            if let Some(index) = found {
                // Remove the asset from the list
                self.asset_list.remove(&index);

                // Fire RemoveAssetEvent
                Runtime::emit_event(UntrackAssetEvent { asset });
            } else {
                panic!("Cannot find asset {:?} in the asset list. It is likely not added.", asset);
            }
        }

        //. ---------- Price Stream Management --------- /
        pub fn link_price_stream(&mut self, price_stream_address: ComponentAddress) {
            self.price_stream_address = Some(price_stream_address);
        }

        pub fn unlink_price_stream(&mut self) {
            self.price_stream_address = None;
        }

        //. -------------- Utility Methods ------------- /
        // ! Testing Methods
        pub fn log_asset_list(&self) {
            info!("[log_asset_list] Asset list: {:#?}", self.asset_list.to_vec());
        }

        pub fn log_assets(&self) {
            for (i, address, _) in self.asset_list.iter() {
                if let Some(asset) = self.assets.get(&address) {
                    info!("[log_assets] Data for asset {:?}:", address);
                    info!("[log_assets] {:#?}", asset.clone());
                } else {
                    info!("[log_assets] Asset with address {:?} not found", address);
                }
            }
        }

        // * Regular Utility Methods
        /// Checks that the given asset is generally valid, is in the asset_list, and has a corresponding vault
        fn validate_fungible(&self, address: ResourceAddress) -> bool {
            if !address.is_fungible() {
                info!("[validate_fungible] INVALID: Asset {:?} is not fungible", address);
                return false;
            }

            // Check that a vault exists for the given address
            if self.assets.get(&address).is_none() {
                info!("[validate_fungible] INVALID: No asset entry found for {:?}", address);
                return false;
            }

            // Check that the asset is tracked in the asset_list
            let found = self.asset_list.find(&address);
            if found.is_none() {
                info!("[validate_fungible] INVALID: Asset {:?} not tracked in the asset list", address);
                return false;
            }

            // Return true if all checks passed
            true
        }

        /// Checks that the resource provided in the buckets are valid and not empty
        fn validate_bucket(&self, bucket: &Bucket) -> bool {
            // Check that the bucket is not empty
            if bucket.amount() <= dec!(0.0) {
                info!("[validate_bucket] INVALID: Bucket {:?} is empty", bucket);
                return false;
            }

            // Check that the bucket resource is valid according to self.validate
            if !self.validate_fungible(bucket.resource_address()) {
                info!("[validate_bucket] INVALID: Bucket {:?} is invalid", bucket);
                return false;
            }

            // Return true if all checks passed
            true
        }

        /// Checks that all resources provided in the buckets are valid and not empty
        fn validate_buckets(&self, buckets: &Vec<Bucket>) -> bool {
            for bucket in buckets {
                if !self.validate_bucket(bucket) {
                    return false;
                }
            }

            true
        }

        /// Calculates the USD values of all provided asset from the oracle
        // ! Uses a mock price stream
        // TODO: provide epoch to ensure data not out-of-date
        fn get_asset_values(&self, assets: &ValueMap) -> (PreciseDecimal, ValueMap) {
            // Get prices
            let price_stream = self.price_stream();

            let mut usd_values: ValueMap = HashMap::new();
            let mut total = pdec!(0.0);

            for (address, amount) in assets {
                assert!(self.asset_list.find(address).is_some(), "Asset in the ValueMap is not listed ");

                let price = price_stream.get_price(*address).expect(format!("Unable to get price of {:?}", address).as_str());
                let value = price.checked_mul(*amount).unwrap();
                total = total.checked_add(value).unwrap();
                usd_values.insert(*address, value);
            }

            (total, usd_values)
        }

        fn price_stream(&self) -> Global<PriceStream> {
            assert!(self.price_stream_address.is_some(), "Price stream not linked");
            self.price_stream_address.unwrap().into()
        }

        /// Generate a value map from a vector of buckets
        fn buckets_to_value_map(&self, buckets: &Vec<Bucket>) -> ValueMap {
            let mut kv: ValueMap = HashMap::new();

            for bucket in buckets {
                kv.insert(bucket.resource_address(), bucket.amount().into());
            }

            kv
        }
    }
}
