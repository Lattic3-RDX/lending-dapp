/* ------------------ Imports ----------------- */
// Usages
use crate::asset::AssetEntry;
use crate::cluster::{ClusterLayer, ClusterState, ClusterWrapper};
use crate::events::*;
use crate::position::Position;
use crate::utils::ValueMap;
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
#[types(Decimal, ResourceAddress, ValueMap, ComponentAddress, GlobalAddress, AssetEntry, Position)]
mod lattic3 {
    //] --------------- Scrypto Setup -------------- /

    enable_method_auth! {
        roles {
            admin => updatable_by: [OWNER];
        },
        methods {
            // Position management
            open_position     => PUBLIC;
            close_position    => PUBLIC;
            position_supply   => PUBLIC;
            position_borrow   => PUBLIC;
            position_withdraw => PUBLIC;
            position_repay    => PUBLIC;
            // Internal position operations
            get_position_health       => PUBLIC;
            calculate_health_from_units => PUBLIC;
            // Asset management
            add_asset     => restrict_to: [SELF, OWNER];
            track_asset   => restrict_to: [SELF, OWNER, admin];
            untrack_asset => restrict_to: [SELF, OWNER, admin];
            // Price stream management
            link_price_stream   => restrict_to: [SELF, OWNER];
            unlink_price_stream => restrict_to: [SELF, OWNER];
        }
    }

    // External PriceStream blueprint
    extern_blueprint! {
        // "package_sim1pkwaf2l9zkmake5h924229n44wp5pgckmpn0lvtucwers56awywems", // Resim
        "package_tdx_2_1p4ual4cc8tnvm93atjlp9q5ua3ae5l0xkgnd68mlqz6ehlr98qxr53", // Stokenet
        PriceStream {
            fn get_price(&self, asset: ResourceAddress) -> Option<Decimal>;
        }
    }

    // External Cluster blueprint
    extern_blueprint! {
        // "package_sim1pkys4qlttszxq29qw5ys9lvn8grmswd0n6nsxrdxce3er3l85eagjm", // Resim
        "package_tdx_2_1pkxjgnf0sc8cyv63fucee0eqmqjewnrnwqwnt4vwckwgpjwj844t8e", // Stokenet
        Cluster {
            fn instantiate(resource: ResourceAddress, cluster_owner_rule: AccessRule, cluster_admin_rule: AccessRule) -> Global<Cluster>;

            fn supply(&mut self, supply: Bucket) -> Bucket;
            fn withdraw(&mut self, units: Bucket) -> Bucket;
            fn borrow(&mut self, amount: Decimal) -> (Bucket, Decimal);
            fn repay(&mut self, repayment: Bucket) -> Decimal;

            fn get_ratio(&self, layer: ClusterLayer) -> PreciseDecimal;
            fn get_units(&self, layer: ClusterLayer, amount: Decimal) -> Decimal;
            fn get_amount(&self, layer: ClusterLayer, unit_amount: Decimal) -> Decimal;
            fn get_cluster_state(&self) -> ClusterState;

            fn provide_liquidity(&mut self, provided: Bucket);
            fn tick_interest(&mut self, force: bool);
            fn set_interest_tick_interval(&mut self, interval: i64);
        }
    }

    //] ------------- Lattic3 Blueprint ------------ /

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
        /// Instantiate a new Lattic3 platform.
        ///
        /// # Arguments
        /// * `dapp_definition_address` - Address of the dApp definition account.
        /// * `owner_badge` - Badge which represents the owner of the: platform, all clusters, etc.
        ///
        /// # Returns
        /// * Globalized Lattic3 market component
        /// * Lattic3 owner badge
        pub fn instantiate(dapp_definition_address: ComponentAddress, owner_badge: Bucket) -> (Global<Lattic3>, Bucket) {
            // Reserve address
            let (address_reservation, component_address) = Runtime::allocate_component_address(Lattic3::blueprint_id());

            //] Badges and rules
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

            //] Internal data setup
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

            //] Component
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
            // Runtime::emit_event(InstantiseEvent { component_address: component.address(), asset_list });

            // Return
            (component, owner_badge)
        }

        //] ------------ Position Management ----------- /

        /// Opens a new position with the provided supply.
        ///
        /// Distributes supplied resources to corresponding clusters in exchange for supply units,
        /// and mints a new position badge.
        ///
        /// # Arguments
        /// * `supply` - A vector of `Bucket`s which is the supply for the new position.
        ///
        /// # Returns
        /// * A `Bucket` of the minted position badge.
        /// * A vector of `Bucket`s, which are the supply units corresponding to the input supply.
        ///
        /// # Panics
        /// * If the `supply` vector is empty.
        /// * If ome supplied resource is invalid (see `__validate_bucket`).
        /// * If the maximum number of positions has been reached.
        pub fn open_position(&mut self, supply: Vec<Bucket>) -> (Bucket, Vec<Bucket>) {
            // Sanity checks
            assert!(self.__validate_buckets(&supply), "Invalid supply");
            assert!(self.position_id != u64::MAX, "Cannot open more positions");

            // Initialise empty position
            let mut position = Position::new();

            // Supply resources to clusters
            let mut supply_units: Vec<Bucket> = Vec::new();
            let mut unit_map: ValueMap = HashMap::new();

            for bucket in supply {
                let address = bucket.resource_address();
                let mut asset = self.assets.get_mut(&address).expect("Cannot get asset entry");

                let pool_unit = asset.cluster_wrapper.cluster.supply(bucket);

                unit_map.insert(address, pool_unit.amount());
                supply_units.push(pool_unit);
            }

            position.update_supply(&unit_map);

            // Mint and return position NFT
            self.position_id += 1;
            let position_badge = self
                .position_manager
                .mint_non_fungible(&NonFungibleLocalId::Integer(self.position_id.into()), position);

            // Fire open position event
            // Runtime::emit_event(OpenPositionEvent {
            //     position_id: NonFungibleLocalId::Integer(self.position_id.into()),
            //     supply: unit_map,
            // });
            info!("[open_position] Position event");

            // Return
            (position_badge, supply_units)
        }

        /// Closes a position by burning the position NFT.
        ///
        /// # Panics
        /// * If the `position_bucket` is not a valid position NFT.
        /// * If the position is not clear (remaining supply or debts).
        ///
        /// # Events
        /// * This function emits a `PositionCloseEvent` on successful execution.
        pub fn close_position(&self, position_bucket: NonFungibleBucket) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert!(self.__validate_position_bucket(&position_bucket), "Invalid position NFT");

            // Fetch NFT data
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            assert!(position.debt.is_empty(), "Cannot close position with debts");
            assert!(position.supply.is_empty(), "Cannot close position with supplied assets");

            // Burn the nft
            position_bucket.burn();

            // Fire position close event
            Runtime::emit_event(PositionCloseEvent {});
        }

        //# --------------- Supply Layer --------------- /

        /// Supplies resources to a position.
        ///
        /// Distributes supplied resources to corresponding clusters in exchange for supply units,
        /// and updates the position NFT accordingly.
        ///
        /// # Arguments
        /// * `position_node` - A proof of the position NFT.
        /// * `supply` - A vector of `Bucket`s which are the supplied assets.
        ///
        /// # Returns
        /// * A vector of `Bucket`s of returned the supply units.
        ///
        /// # Panics
        /// * If the `position` is invalid (see `__validate_position`).
        /// * If the `supply` vector is empty.
        /// * If some supplied resource is invalid (see `__validate_bucket`).
        ///
        /// # Events
        /// * Emits a `PositionSupplyEvent` on successful supply.
        pub fn position_supply(&mut self, position_node: NonFungibleProof, supply: Vec<Bucket>) -> Vec<Bucket> {
            // Sanity checks
            assert!(self.__validate_buckets(&supply), "Invalid supply");

            // Fetch NFT data
            let (mut position, local_id) = self.__validate_position(position_node);
            info!("[position_supply] Position: {:#?}", position);

            // Supply resources to clusters
            // let supply_map = self.__buckets_to_value_map(&supply);
            let mut supply_units: Vec<Bucket> = Vec::new();
            let mut unit_map: ValueMap = HashMap::new();

            for bucket in supply {
                let address = bucket.resource_address();
                let mut asset = self.assets.get_mut(&address).expect("Cannot get asset entry");

                let pool_unit = asset.cluster_wrapper.cluster.supply(bucket);

                unit_map.insert(address, pool_unit.amount());
                supply_units.push(pool_unit);
            }

            position.update_supply(&unit_map);

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "supply", position.supply);

            // Fire position supply event
            // Runtime::emit_event(PositionSupplyEvent { position_id: local_id, supply: supply_map, supply_units: unit_map });

            // Return
            supply_units
        }

        /// Withdraws assets from a position's supply.
        ///
        /// # Arguments
        /// * `position_node` - A proof of the position NFT.
        /// * `units` - A `Bucket` of the supply units to withdraw.
        /// * `requested` - An optional `Decimal` representing the maximum amount of assets to withdraw.
        ///                 If not provided, the full amount will be withdrawn.
        ///                 Otherwise, the unredeemed supply units are returned as change.
        ///
        /// # Returns
        /// * A `Bucket` of leftover supply units if limited by `requested`.
        /// * A `Bucket` of the withdrawn assets.
        ///
        /// # Panics
        /// * If the `position_node` is invalid (see `__validate_position`).
        /// * If the `units` bucket is empty.
        /// * If the operation puts the position in an invalid state (health below 1.0).
        ///
        /// # Events
        /// * Emits a `PositionWithdrawEvent` on successful withdrawal
        pub fn position_withdraw(&mut self, position_node: NonFungibleProof, mut units: Bucket, requested: Option<Decimal>) -> (Bucket, Bucket) {
            // Sanity checks
            let (mut position, local_id) = self.__validate_position(position_node);
            info!("[position_supply] Position: {:#?}", position);

            let unit_address = units.resource_address();
            assert!(!units.is_empty(), "Bucket for {:?} is empty", unit_address);

            // Get debt unit's source asset
            let address = *self
                .supply_unit_to_address
                .get(&unit_address)
                .expect(format!("Cannot get address for pool unit {:?}", unit_address).as_str());
            let mut cluster = self.assets.get(&address).expect("Cannot get asset entry").cluster_wrapper.cluster;

            // If requested is Some, limit the amount of units provided by the unit amount of requested
            let requested_units: Decimal = if let Some(amount) = requested {
                cluster.get_units(ClusterLayer::Supply, amount)
            } else {
                Decimal::MAX
            };
            let unit_amount: Decimal = units.amount().min(requested_units);

            // Recalculate supply
            position.update_supply(&HashMap::from([(address, unit_amount.checked_mul(dec!(-1)).unwrap())]));

            // Withdraw from cluster
            let withdrawn = cluster.withdraw(units.take(unit_amount));

            // Ensure that operation won't put position health below 1.0
            let health = self.calculate_health_from_units(position.supply.clone(), position.debt.clone());
            assert!(health >= dec!(1.0), "Position health will be below 1.0. Reverting operation");

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "supply", position.supply);

            // Fire position withdraw event
            // Runtime::emit_event(PositionWithdrawEvent {
            //     position_id: local_id.clone(),
            //     supply_unit: (supply_unit_address, supply_unit_amount),
            //     withdraw: (address, withdrawn.amount().into()),
            // });

            (units, withdrawn)
        }

        //# ---------------- Debt Layer ---------------- /

        /// Borrows resources against supply.
        ///
        /// Borrows resources from their corresponding clusters and updates the position NFT accordingly.
        /// The operation keeps the position's health above 1.0.
        ///
        /// # Arguments
        /// * `position_node` - A proof of the position NFT.
        /// * `debt` - A `ValueMap` of the assets to borrow.
        ///
        /// # Returns
        /// * A vector of `Bucket`s representing the borrowed resources.
        ///
        /// # Panics
        /// * If the `position` is invalid (see `__validate_position`).
        /// * If some borrowed resource is invalid (see `__validate_fungible`).
        /// * If the maximum number of positions has been reached.
        /// * If the operation would put the position health below 1.0.
        pub fn position_borrow(&mut self, position_node: NonFungibleProof, debt: ValueMap) -> Vec<Bucket> {
            // Sanity checks
            let (mut position, local_id) = self.__validate_position(position_node);
            info!("[position_supply] Position: {:#?}", position);

            for (&address, &amount) in &debt {
                assert!(amount > dec!(0.0), "Borrow amount must be greater than 0");
                assert!(self.__validate_fungible(address), "Asset with address {:?} is invalid", address);
            }

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
            let health = self.calculate_health_from_units(position.supply, position.debt.clone());
            assert!(health >= dec!(1.0), "Position health will be below 1.0. Reverting operation");

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "debt", position.debt);

            // Fire position borrow event
            // Runtime::emit_event(PositionBorrowEvent { position_id: local_id, debt, debt_units });

            // Return borrowed resources
            borrowed
        }

        /// Repays debt for a position.
        ///
        /// Repays resources against borrowed resources and updates the position NFT accordingly.
        /// The operation keeps the position's health above 1.0.
        ///
        /// # Arguments
        /// * `position_node` - A proof of the position NFT.
        /// * `repayment` - A `Bucket` of the resources to repay.
        /// * `requested` - An optional `Decimal` representing the maximum amount of resources to repay.
        ///                 If not provided, the full amount will be repaid.
        ///                 Otherwise, the unredeemed supply units are returned as change.
        ///
        /// # Returns
        /// * A `Bucket` of leftover repayment units if limited by `requested`.
        ///
        /// # Panics
        /// * If the `position` is invalid (see `__validate_position`).
        /// * If some repayment resource is invalid (see `__validate_fungible`).
        /// * If the operation would put the position health below 1.0.
        ///
        /// # Events
        /// * Emits a `PositionRepayEvent` on successful repayment
        pub fn position_repay(&mut self, position_node: NonFungibleProof, mut repayment: Bucket, requested: Option<Decimal>) -> Bucket {
            // Sanity checks
            let (mut position, local_id) = self.__validate_position(position_node);
            info!("[position_supply] Position: {:#?}", position);

            let address = repayment.resource_address();

            // Ensure repayment is valid
            assert!(!repayment.is_empty(), "Bucket for {:?} is empty", address);
            assert!(position.debt.contains_key(&address), "Asset {:?} not borrowed", address);

            // Convert debt to debt units
            let mut cluster = self.assets.get(&address).expect("Cannot get asset entry").cluster_wrapper.cluster;

            // Limit repayment amount by the requested amount, and by the debt owed to prevent overpayment
            let debt = cluster.get_amount(ClusterLayer::Debt, *position.debt.get(&address).expect("Asset not borrowed"));
            let repay_amount = repayment.amount().min(debt).min(requested.unwrap_or(Decimal::MAX));

            // Execute repayment
            let repay_units = cluster.repay(repayment.take(repay_amount));

            // Recalculate debt
            position.update_debt(&HashMap::from([(address, repay_units.checked_mul(dec!(-1)).unwrap())]));

            // Fire position repay event
            // Runtime::emit_event(PositionRepayEvent { position_id: local_id.clone(), repay: (address, amount) });

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "debt", position.debt);

            repayment
        }

        /// Retrieves the health of a specified position.
        ///
        /// This function calculates the health of a given position using its supply and debt data
        /// by invoking the `calculate_health_from_units` method.
        ///
        /// # Arguments
        /// * `position_proof` - A proof of the position NFT used to verify and fetch the position data.
        ///
        /// # Returns
        /// * The health of the position as a `Decimal`.
        ///
        /// # Panics
        /// * If the `position_proof` is invalid.
        pub fn get_position_health(&mut self, position_proof: NonFungibleProof) -> Decimal {
            // Sanity checks
            let position: Position = position_proof
                .check_with_message(self.position_manager.address(), "Position check failed")
                .non_fungible::<Position>()
                .data();
            info!("[get_position_health] Position: {:#?}", position);

            let health = self.calculate_health_from_units(position.supply, position.debt);

            health
        }

        /// Calculates the health of a position based from its supply and debt.
        ///
        /// <div class="warning">This function ticks the interest on all clusters in the position, and is therefore expensive.</div>
        ///
        /// # Arguments
        /// * `supply_units` - A `ValueMap` of the supplied asset units.
        /// * `debt_units` - A `ValueMap` of the borrowed asset units.
        ///
        /// # Returns
        /// * The health of the position as a `Decimal`.
        ///
        /// # Events
        /// * This function emits a `PositionHealthEvent` on successful health calculation.
        pub fn calculate_health_from_units(&mut self, supply_units: ValueMap, debt_units: ValueMap) -> Decimal {
            // Return 'infinity' if no debt taken out
            if debt_units.is_empty() {
                info!("[calculate_position_health] Health: Infinity {:?}", Decimal::MAX);

                // Runtime::emit_event(PositionHealthEvent { health: Decimal::MAX });
                return Decimal::MAX;
            }

            // Tick interest on all position assets and convert them from units to amounts
            let mut updated_addresses: IndexSet<ResourceAddress> = IndexSet::new();

            let supply: ValueMap = supply_units
                .iter()
                .map(|(&address, &unit_amount)| {
                    if updated_addresses.insert(address) {
                        self.assets.get_mut(&address).unwrap().cluster_wrapper.cluster.tick_interest(true);
                    }

                    let amount = self
                        .assets
                        .get(&address)
                        .unwrap()
                        .cluster_wrapper
                        .cluster
                        .get_amount(ClusterLayer::Supply, unit_amount);
                    info!("Supply {:?}; units: {:?} -> amount: {:?}", address, unit_amount, amount);
                    (address, amount)
                })
                .collect();

            let debt: ValueMap = debt_units
                .iter()
                .map(|(&address, &unit_amount)| {
                    if updated_addresses.insert(address) {
                        self.assets.get_mut(&address).unwrap().cluster_wrapper.cluster.tick_interest(true);
                    }

                    let amount = self
                        .assets
                        .get(&address)
                        .unwrap()
                        .cluster_wrapper
                        .cluster
                        .get_amount(ClusterLayer::Debt, unit_amount);
                    info!("Debt {:?}; units: {:?} -> amount: {:?}", address, unit_amount, amount);
                    (address, amount)
                })
                .collect();

            // Calculate supply value
            let (supply_value, _) = self.__get_asset_values(&supply);
            info!("[calculate_position_health] Supply value: {}", supply_value);

            // Calculate debt value
            let (debt_value, _) = self.__get_asset_values(&debt);
            info!("[calculate_position_health] Debt value: {}", debt_value);

            // Sanity check
            assert!(
                debt_value > dec!(0.0),
                "Debt value must be greater than 0, I don't know how we got here. Debt: {:?}",
                debt
            );

            // health = (supply / debt), * 100 for display
            let health = supply_value.checked_div(debt_value).unwrap();
            info!("[calculate_position_health] Health: {:?}", health);

            // Fire health event
            // Runtime::emit_event(PositionHealthEvent { health });

            health
        }

        //] --------------- Asset Listing -------------- /

        /// Add a fungible asset into the market, and output a FungibleAsset struct
        pub fn add_asset(&mut self, address: ResourceAddress) {
            info!("[add_asset] Adding asset: {:?}", address);

            // Sanity checks
            assert!(address.is_fungible(), "Provided asset must be fungible.");
            assert!(self.assets.get(&address).is_none(), "Asset already has an entry");
            assert!(
                !self.__validate_fungible(address),
                "Cannot add asset {:?}, as it is already added and tracked",
                address
            );

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
            assert!(
                !self.__validate_fungible(asset),
                "Cannot add asset {:?}, as it is already added and tracked",
                asset
            );
            assert!(asset.is_fungible(), "Provided asset must be fungible.");
            assert!(self.assets.get(&asset).is_some(), "No asset entry for {:?}, run add_asset first", asset);
            // assert!(self.pools.get(&asset).is_some(), "No pool for asset {:?}, run add_asset first", asset);

            // Append the asset into the asset list
            self.asset_list.insert(asset);
        }

        /// Removes an asset from the asset list
        pub fn untrack_asset(&mut self, asset: ResourceAddress) {
            info!("[untrack_asset] Removing asset: {:?}", asset);

            // Sanity checks
            assert!(self.__validate_fungible(asset), "Asset with address {:?} is invalid", asset);

            // Remove asset
            if self.asset_list.shift_remove(&asset) {
                Runtime::emit_event(UntrackAssetEvent { asset });
            } else {
                panic!("Cannot find asset {:?} in the asset list. It is likely not added.", asset);
            }
        }

        //] ---------- Price Stream Management --------- /
        pub fn link_price_stream(&mut self, price_stream_address: ComponentAddress) {
            self.price_stream_address = Some(price_stream_address);
        }

        pub fn unlink_price_stream(&mut self) {
            self.price_stream_address = None;
        }

        //] -------------- Utility Methods ------------- /

        /// Checks that the given asset is generally valid, is in the asset_list, and has a corresponding vault
        fn __validate_fungible(&self, address: ResourceAddress) -> bool {
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
            if !self.asset_list.contains(&address) {
                info!("[validate_fungible] INVALID: Asset {:?} not tracked in the asset list", address);
                return false;
            }

            // Return true if all checks passed
            true
        }

        /// Checks that the resource provided in the buckets are valid and not empty
        fn __validate_bucket(&self, bucket: &Bucket) -> bool {
            // Check that the bucket is not empty
            if bucket.is_empty() {
                info!("[validate_bucket] INVALID: Bucket {:?} is empty", bucket);
                return false;
            }

            // Check that the bucket resource is valid according to self.validate
            if !self.__validate_fungible(bucket.resource_address()) {
                info!("[validate_bucket] INVALID: Bucket {:?} is invalid", bucket);
                return false;
            }

            // Return true if all checks passed
            true
        }

        /// Checks that all resources provided in the buckets are valid and not empty
        fn __validate_buckets(&self, buckets: &Vec<Bucket>) -> bool {
            assert!(!buckets.is_empty(), "Provided buckets are empty");

            for bucket in buckets {
                if !self.__validate_bucket(bucket) {
                    return false;
                }
            }

            true
        }

        fn __validate_position_bucket(&self, position: &NonFungibleBucket) -> bool {
            if position.amount() != dec!(1) {
                return false;
            }

            if position.resource_address() != self.position_manager.address() {
                return false;
            }

            true
        }

        fn __validate_position(&self, position: NonFungibleProof) -> (Position, NonFungibleLocalId) {
            let checked = position.check_with_message(self.position_manager.address(), "Position check failed");
            let local_id = checked.non_fungible_local_id();
            let position = checked.non_fungible::<Position>().data();

            (position, local_id)
        }

        /// Calculates the USD values of all provided asset from the oracle
        // TODO: provide epoch to ensure data not out-of-date
        fn __get_asset_values(&self, assets: &ValueMap) -> (Decimal, ValueMap) {
            // Get prices
            let price_stream = self.__price_stream();

            let mut usd_values: ValueMap = HashMap::new();
            let mut total = dec!(0.0);

            for (&address, &amount) in assets {
                assert!(self.__validate_fungible(address), "Asset in the ValueMap is not listed ");

                let price = price_stream
                    .get_price(address)
                    .expect(format!("Unable to get price of {:?}", address).as_str());
                let value = amount.checked_mul(price).unwrap();
                total = total.checked_add(value).unwrap();
                usd_values.insert(address, value);
            }

            (total, usd_values)
        }

        fn __price_stream(&self) -> Global<PriceStream> {
            assert!(self.price_stream_address.is_some(), "Price stream not linked");
            self.price_stream_address.unwrap().into()
        }

        /// Generate a value map from a vector of buckets
        fn __buckets_to_value_map(&self, buckets: &Vec<Bucket>) -> ValueMap {
            let mut kv: ValueMap = HashMap::new();

            for bucket in buckets {
                kv.insert(bucket.resource_address(), bucket.amount());
            }

            kv
        }
    }
}
