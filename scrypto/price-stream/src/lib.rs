/* ------------------ Imports ----------------- */
use scrypto::prelude::*;

/* --------------- Price Stream --------------- */
#[blueprint]
mod lattic3_price_stream {
    enable_method_auth! {
        roles {
            updater => updatable_by: [];
        },
        methods {
            get_price    => PUBLIC;

            update_asset => restrict_to: [OWNER, updater];
            add_asset    => restrict_to: [OWNER];
            remove_asset => restrict_to: [OWNER];
        }
    }

    struct PriceStream {
        owner_badge_address: ResourceAddress,
        updater_manager: ResourceManager,

        prices: HashMap<ResourceAddress, Decimal>,
    }

    impl PriceStream {
        pub fn instantiate(dapp_definition_address: ComponentAddress, owner_badge: Bucket) -> (Global<PriceStream>, Bucket) {
            // Address reservation
            let (address_reservation, component_address) = Runtime::allocate_component_address(PriceStream::blueprint_id());

            //. Badges and rules
            // Component
            let component_access_rule: AccessRule = rule!(require(global_caller(component_address)));

            // Component owner
            // / let owner_badge: Bucket = ResourceBuilder::new_fungible(OwnerRole::None)
            // /     .divisibility(DIVISIBILITY_NONE)
            // /     .metadata(metadata! {init {
            // /         "name"        => "Lattic3 Price Stream Owner Badge", locked;
            // /         "description" => "Badge representing the owner of the Lattic3 price stream", locked;
            // /     }})
            // /     .mint_initial_supply(1)
            // /     .into();
            let owner_access_rule: AccessRule = rule!(require(owner_badge.resource_address()));
            let owner_role: OwnerRole = OwnerRole::Fixed(owner_access_rule.clone());

            // Badge indicating that the account is allowed to provide data to the price stream
            // TODO: replace with non-fungible
            let updater_manager: ResourceManager = ResourceBuilder::new_fungible(owner_role.clone())
                .divisibility(DIVISIBILITY_NONE)
                .metadata(metadata! {init {
                    "name"        => "Lattic3 PriceStream Updater Badge", locked;
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
            let updater_access_rule: AccessRule = rule!(require(updater_manager.address()));

            //. Component data
            let mut component_data = PriceStream {
                owner_badge_address: owner_badge.resource_address(),
                updater_manager,
                prices: HashMap::new(),
            };

            // ! -------- TESTING --------
            component_data.prices.insert(XRD, dec!(0.01579));
            // ! -/-/-/-/ TESTING -/-/-/-/

            //. Instantiate component
            let component_metadata = metadata! {
                roles {
                    metadata_setter         => OWNER;
                    metadata_setter_updater => OWNER;
                    metadata_locker         => OWNER;
                    metadata_locker_updater => rule!(deny_all);
                },
                init {
                    "name"            => "Lattic3 Price Stream", locked;
                    "description"     => "Price stream for the Lattic3 lending platform", locked;
                    "dapp_definition" => dapp_definition_address, updatable;
                }
            };

            // Roles
            let component_roles = roles! {
                updater => updater_access_rule.clone();
            };

            // Instantisation
            let component: Global<PriceStream> = component_data
                .instantiate()
                .prepare_to_globalize(owner_role)
                .roles(component_roles)
                .metadata(component_metadata)
                .with_address(address_reservation)
                .globalize();

            // Return
            (component, owner_badge)
        }

        pub fn update_asset(&mut self, asset: ResourceAddress, price: Decimal) {
            assert!(self.prices.get(&asset).is_some(), "Cannot update the price of an asset; asset not listed");

            *self.prices.get_mut(&asset).unwrap() = price;
        }

        pub fn add_asset(&mut self, asset: ResourceAddress, price: Decimal) {
            assert!(self.prices.get(&asset).is_none(), "Asset already added");

            self.prices.insert(asset, price);
        }

        pub fn remove_asset(&mut self, asset: ResourceAddress) {
            assert!(self.prices.get(&asset).is_some(), "Asset not listed");

            self.prices.remove(&asset);
        }

        pub fn get_price(&self, asset: ResourceAddress) -> Option<Decimal> {
            if let Some(price) = self.prices.get(&asset) {
                info!("[PriceStream:get_price] Price of {:?} is {:?}", asset, *price);
                Some(*price)
            } else {
                info!("[PriceStream:get_price] Cannot get price of  {:?}", asset);
                None
            }
        }
    }
}
