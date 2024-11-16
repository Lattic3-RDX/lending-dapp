/* ------------------ Imports ----------------- */
// Usages
use crate::asset::{AssetEntry, ADDRESSES};
use crate::events::*;
use crate::pool::{Pool, TPool};
use crate::position::Position;
use crate::utils::{p_to_dec, LazyVec, ValueMap};
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
#[types(Decimal, ResourceAddress, ComponentAddress, GlobalAddress, AssetEntry, TPool, Pool, Position)]
mod lattic3 {
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
            // Asset operations
            get_redemption_value => PUBLIC;
            hard_deposit         => restrict_to: [SELF, OWNER];
            hard_withdraw        => restrict_to: [SELF, OWNER];
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

    struct Lattic3 {
        component_address: ComponentAddress,

        owner_badge_address: ResourceAddress,
        admin_manager: ResourceManager,

        asset_list: LazyVec<ResourceAddress>, // List of all 'tracked' assets; serves as a filter out of all added assets
        assets: KeyValueStore<ResourceAddress, AssetEntry>,
        address_to_pool_unit: KeyValueStore<ResourceAddress, ResourceAddress>,
        pool_unit_to_address: KeyValueStore<ResourceAddress, ResourceAddress>,

        price_stream_address: Option<ComponentAddress>,

        position_manager: ResourceManager,
        position_id: u64,
    }

    impl Lattic3 {
        pub fn instantiate(
            dapp_definition_address: ComponentAddress,
            owner_badge: Bucket,
            // ! -------- TESTING --------
            test_assets: Vec<ResourceAddress>,
            // ! -/-/-/-/-/-/-/-/-/-/-/-/-
        ) -> (Global<Lattic3>, Bucket) {
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
            let mut component_data: Lattic3 = Self {
                component_address,
                owner_badge_address: owner_badge.resource_address(),
                admin_manager,
                asset_list: LazyVec::new(),
                assets: KeyValueStore::new(),
                address_to_pool_unit: KeyValueStore::new(),
                pool_unit_to_address: KeyValueStore::new(),
                price_stream_address: None,
                position_manager,
                position_id: 0u64,
            };

            // Add all assets
            let mut assets: Vec<ResourceAddress> = ADDRESSES.clone().to_vec();
            let owner_proof = owner_badge.create_proof_of_all();

            // ! -------- TESTING --------
            for address in test_assets {
                assets.push(address);
            }
            // ! -/-/-/-/-/-/-/-/-/-/-/-/-

            for address in assets {
                let asset = Lattic3::add_asset(&mut component_data, address);

                // ! Set pool unit metadata; has to be done manually for assets not in the instantisation asset list
                let pool_unit_rm: ResourceManager = ResourceManager::from_address(asset.pool.pool_unit.clone());

                let meta_name = format!("Lattic3 {} Pool Unit", asset.name).to_string();
                let meta_symbol = format!("$lt3{}", asset.symbol).to_string();
                let meta_description = format!("Lattic3 pool unit for the {} pool", asset.symbol).to_string();

                owner_proof.authorize(|| {
                    pool_unit_rm.set_metadata("name", meta_name);
                    pool_unit_rm.set_metadata("symbol", meta_symbol);
                    pool_unit_rm.set_metadata("description", meta_description);
                });
            }

            //. Component
            let asset_list: Vec<ResourceAddress> = component_data.asset_list.to_vec();

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
            assert!(self.validate_buckets(&supply), "Some supplied resource is invalid, check logs");
            assert!(self.position_id != u64::MAX, "Cannot open more positions");

            // Record supplied resources
            let valuemap = self.buckets_to_value_map(&supply);
            // let (total_price, prices) = self.get_asset_values(valuemap.clone());

            // info!("[open_position] Total price: {}", total_price);
            // info!("[open_position] Prices: {:#?}", prices);

            // Dump supplied resources into pools
            let mut pool_units: Vec<Bucket> = Vec::new();
            for bucket in supply {
                // let mut asset = self.assets.get_mut(&bucket.resource_address()).expect("Cannot get asset entry");
                let pool_unit = self.contribute(bucket);

                pool_units.push(pool_unit);
            }

            // Mint and return position NFT
            info!("[open_position] Valuemap: {:#?}", valuemap);
            let position: Position = Position::new(valuemap.clone());
            info!("[open_position] Position: {:#?}", position);
            self.position_id += 1;
            info!("[open_position] Incremented position counter");
            let position_badge = self.position_manager.mint_non_fungible(&NonFungibleLocalId::Integer(self.position_id.into()), position);
            info!("[open_position] Minted badge");

            // Fire open position event
            Runtime::emit_event(OpenPositionEvent {
                position_id: NonFungibleLocalId::Integer(self.position_id.into()),
                supply: valuemap,
            });
            info!("[open_position] Position event");

            // Return
            (position_badge, pool_units)
        }

        pub fn close_position(&mut self, position_bucket: NonFungibleBucket) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            // Burn the nft
            position_bucket.burn();
            // self.position_manager.burn(position_bucket);

            // Decrement the number of open positions
            // self.open_positions -= 1; // ! Find a way to generate new NFTs with repeatable local ids

            // Fire position close event
            Runtime::emit_event(PositionCloseEvent {});
        }

        pub fn position_supply(&mut self, position_bucket: NonFungibleBucket, supply: Vec<Bucket>) -> (NonFungibleBucket, Vec<Bucket>) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");
            assert!(self.validate_buckets(&supply), "Some supplied resource is invalid, check logs");

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_supply] Position: {:#?}", position);

            // Record supplied resources
            let provided = self.buckets_to_value_map(&supply);
            let mut new_supply = provided.clone();
            for (address, amount) in position.supply {
                if let Some(existing) = new_supply.get(&address) {
                    new_supply.insert(address, existing.checked_add(amount).unwrap());
                } else {
                    new_supply.insert(address, amount);
                }
            }

            // Dump supplied resources into pools
            let mut pool_units: Vec<Bucket> = Vec::new();
            for bucket in supply {
                // let mut asset = self.assets.get_mut(&bucket.resource_address()).expect("Cannot get asset entry");
                let pool_unit = self.contribute(bucket);

                pool_units.push(pool_unit);
            }

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "supply", new_supply.clone());

            // Fire position supply event
            Runtime::emit_event(PositionSupplyEvent {
                position_id: local_id,
                provided,
                supply: new_supply,
                pool_units: self.buckets_to_value_map(&pool_units),
            });

            // Return
            (position_bucket, pool_units)
        }

        pub fn position_borrow(&mut self, position_bucket: NonFungibleBucket, borrow: ValueMap) -> (NonFungibleBucket, Vec<Bucket>) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            for (address, amount) in &borrow {
                assert!(amount > &pdec!(0.0), "Borrow amount must be greater than 0");
                assert!(self.validate_fungible(*address), "Asset with address {:?} is invalid", address);
            }

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_borrow] Position: {:#?}", position);

            // Record borrowed resources
            let mut new_debt = borrow.clone();
            for (address, amount) in position.debt {
                if let Some(existing) = new_debt.get(&address) {
                    new_debt.insert(address, existing.checked_add(amount).unwrap());
                } else {
                    new_debt.insert(address, amount);
                }
            }

            // Ensure that operation won't put position health below 1.0
            let health = self.calculate_position_health(position.supply, new_debt.clone());
            assert!(health >= pdec!(1.0), "Position health will be below 1.0. Reverting operation");

            // Get resources from pools
            let mut borrowed: Vec<Bucket> = Vec::new();
            for (address, amount) in &borrow {
                // let mut asset = self.assets.get_mut(&bucket.resource_address()).expect("Cannot get asset entry");
                let borrow = self.hard_withdraw(*address, *amount);

                borrowed.push(borrow);
            }

            // Update NFT data
            self.position_manager.update_non_fungible_data(&local_id, "debt", new_debt.clone());

            // Fire position borrow event
            Runtime::emit_event(PositionBorrowEvent { position_id: local_id, requested: borrow, debt: new_debt });

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
            assert!(self.pool_unit_to_address.get(&pool_unit_address).is_some(), "Address not found for pool unit {:?}", pool_unit_address);

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_withdraw] Position: {:#?}", position);

            // Get pool unit's source asset
            let address = *self
                .pool_unit_to_address
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
                provided_pool_unit: (pool_unit_address, provided),
                supply: new_supply.clone(),
                withdrawn: (address, withdrawn.amount().into()),
            });

            // Update NFT data or burn if empty
            if new_supply.is_empty() && position.debt.is_empty() {
                self.close_position(position_bucket);
                return (None, withdrawn);
            }

            self.position_manager.update_non_fungible_data(&local_id, "supply", new_supply);

            (Some(position_bucket), withdrawn)
        }

        pub fn position_repay(&mut self, position_bucket: NonFungibleBucket, mut repayment: Bucket) -> (Option<NonFungibleBucket>, Bucket) {
            // Sanity checks
            assert_eq!(position_bucket.amount(), dec!(1), "Position NFT must be provided");
            assert_eq!(position_bucket.resource_address(), self.position_manager.address(), "Position NFT must be provided");

            let repayment_address = repayment.resource_address();
            let repaid: PreciseDecimal = repayment.amount().into();
            assert!(!repayment.is_empty(), "Bucket for {:?} is empty", repayment_address);

            // Fetch NFT data
            let local_id = position_bucket.non_fungible_local_id();
            let position: Position = position_bucket.as_non_fungible().non_fungible::<Position>().data();
            info!("[position_repay] Position: {:#?}", position);

            // Ensure that the provided asset is borrowed
            assert!(position.debt.contains_key(&repayment_address), "Asset {:?} not borrowed", repayment_address);

            // Get repayment
            let borrowed = *position
                .debt
                .get(&repayment_address)
                .expect(format!("Cannot get borrowed amount for asset {:?}", repayment_address).as_str());
            let repay_amount = if repaid > borrowed { borrowed } else { repaid };

            let mut bucket = Bucket::new(repayment_address);
            bucket.put(repayment.take(p_to_dec(repay_amount)));

            // Dump repayment into pool
            self.hard_deposit(bucket);

            // Update NFT data
            let mut new_debt = position.debt;
            let borrowed_amount = borrowed.checked_sub(repay_amount).unwrap();

            // Update KV if the new borrowed amount > 0, else delete the entry
            if borrowed_amount > pdec!(0.0) {
                new_debt.insert(repayment_address, borrowed_amount);
            } else {
                new_debt.remove(&repayment_address);
            }

            // Fire position repay event
            Runtime::emit_event(PositionRepayEvent {
                position_id: local_id.clone(),
                repaid: (repayment_address, repaid),
                debt: new_debt.clone(),
            });

            // Update NFT data or burn if empty
            if position.supply.is_empty() && new_debt.is_empty() {
                self.close_position(position_bucket);
                return (None, repayment);
            }

            self.position_manager.update_non_fungible_data(&local_id, "debt", new_debt);

            (Some(position_bucket), repayment)
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

        //. ------------- Asset Operations ------------- /
        fn contribute(&mut self, contribution: Bucket) -> Bucket {
            // Sanity checks
            assert!(self.validate_bucket(&contribution), "Bucket for {:?} is invalid", contribution.resource_address());

            // Contribute asset
            let mut asset = self.assets.get_mut(&contribution.resource_address()).expect("Cannot get asset entry");

            // TODO: Validate nominal operating status

            info!("[contribute] Contributing [{:?} : {:?}]", contribution.resource_address(), contribution.amount());
            let pool_unit: Bucket = asset.pool.component.contribute(contribution);
            info!("[contribute] Received pool unit [{:?} : {:?}]", pool_unit.resource_address(), pool_unit.amount());

            pool_unit
        }

        fn redeem(&mut self, pool_units: Bucket) -> Bucket {
            // Sanity checks
            assert!(!pool_units.is_empty(), "Bucket for {:?} is empty", pool_units.resource_address());
            assert!(
                self.pool_unit_to_address.get(&pool_units.resource_address()).is_some(),
                "Address not found for pool unit {:?}",
                pool_units.resource_address()
            );

            // Redeem asset
            let address = *self.pool_unit_to_address.get(&pool_units.resource_address()).unwrap();
            let mut asset = self.assets.get_mut(&address).expect("Cannot get asset entry");

            // TODO: Validate nominal operating status

            info!("[redeem] Redeeming [{:?} : {:?}]", pool_units.resource_address(), pool_units.amount());
            let redemption: Bucket = asset.pool.component.redeem(pool_units);
            info!("[redeem] Received resource [{:?} : {:?}]", redemption.resource_address(), redemption.amount());

            redemption
        }

        pub fn get_redemption_value(&self, pool_unit: ResourceAddress, amount: PreciseDecimal) -> PreciseDecimal {
            let address = self.pool_unit_to_address.get(&pool_unit).expect(format!("Unable to find asset for pool unit {:?}", pool_unit).as_str());
            let asset = self.assets.get(&address).unwrap();

            let redemption = asset.pool.component.get_redemption_value(p_to_dec(amount));

            info!("[get_redemption_value] Pool unit: [{:?} : {:?}], redeems: [{:?} : {:?}]", pool_unit, amount, *address, redemption);
            redemption.into()
        }

        pub fn hard_deposit(&mut self, bucket: Bucket) {
            // Sanity checks
            assert!(!bucket.is_empty(), "Bucket for {:?} is empty", bucket.resource_address());
            assert!(self.validate_fungible(bucket.resource_address()), "Asset with address {:?} is invalid", bucket.resource_address());

            // Execute protected deposit
            let amount = bucket.amount();
            let mut asset = self.assets.get_mut(&bucket.resource_address()).expect("Cannot get asset entry");
            asset.pool.component.protected_deposit(bucket);

            info!("[hard_deposit] Deposited [{:?} : {:?}]", asset.address, amount);
        }

        pub fn hard_withdraw(&mut self, address: ResourceAddress, amount: PreciseDecimal) -> Bucket {
            // Sanity checks
            assert!(self.validate_fungible(address), "Asset with address {:?} is invalid", address);

            // Execute protected withdraw
            let mut asset = self.assets.get_mut(&address).expect("Cannot get asset entry");
            let bucket = asset.pool.component.protected_withdraw(p_to_dec(amount), WithdrawStrategy::Rounded(RoundingMode::ToZero));
            assert_eq!(bucket.amount(), p_to_dec(amount), "Withdrawal does not match requested amount");

            info!("[hard_withdraw] Withdrawn {:?} of {:?}", bucket.amount(), address);
            bucket
        }

        //. --------------- Asset Listing -------------- /
        /// Add a fungible asset into the market, and output a FungibleAsset struct
        pub fn add_asset(&mut self, address: ResourceAddress) -> AssetEntry {
            info!("[add_asset] Adding asset: {:?}", address);

            // assert_eq!(self.owner_badge_address, owner_badge.resource_address(), "Owner badge must be provided");

            // Validation
            assert!(address.is_fungible(), "Provided asset must be fungible.");
            assert!(self.assets.get(&address).is_none(), "Asset already has an entry");
            // assert!(self.pools.get(&address).is_none(), "Asset already has a pool");
            assert!(!self.validate_fungible(address), "Cannot add asset {:?}, as it is already added and tracked", address);

            // Pool owned by: Lattic3 owner
            // Pool managed by: Lattic3 owner or component calls
            let pool_owner = OwnerRole::Fixed(rule!(require(self.owner_badge_address)));
            let pool_manager = rule!(require(global_caller(self.component_address)) || require(self.owner_badge_address));
            let pool = Pool::create(pool_owner, pool_manager, address);

            // ! Cannot automatically set proof metadata because of "Moving restricted proof downstream"
            // Set pool unit metadata
            // let pool_unit_rm: ResourceManager = ResourceManager::from_address(pool.pool_unit.clone());

            // let meta_name = format!("Lattic3 {} Pool Unit", asset.name).to_string();
            // let meta_symbol = format!("$rrt{}", asset.symbol).to_string();
            // let meta_description = format!("Lattic3 pool unit for the {} pool", asset.symbol).to_string();

            // info!("Pre-auth");
            // LocalAuthZone::push(owner_badge.clone());

            // owner_badge.authorize(|| {
            //     pool_unit_rm.set_metadata("name", meta_name);
            //     pool_unit_rm.set_metadata("symbol", meta_symbol);
            //     pool_unit_rm.set_metadata("description", meta_description);
            // });
            // info!("Post-auth");

            // Create FungibleAsset
            let asset = AssetEntry::new(address, pool);
            info!("[add_asset] FungibleAsset: {:#?}", asset);

            // Fire AddAssetEvent
            Runtime::emit_event(AddAssetEvent {
                asset: address,
                pool_address: asset.pool.address,
                pool_unit_address: asset.pool.pool_unit_global,
            });

            // self.pools.insert(address, pool);
            self.assets.insert(address, asset.clone());
            self.address_to_pool_unit.insert(address, asset.pool.pool_unit);
            self.pool_unit_to_address.insert(asset.pool.pool_unit, address);
            self.track_asset(address);

            asset
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
