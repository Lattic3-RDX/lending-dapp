/* ------------------ Imports ----------------- */
use crate::utils::*;
use scrypto::prelude::*;

/* ------------------ Cluster ----------------- */
#[blueprint]
mod lattic3_cluster {
    enable_method_auth! {
        // roles {},
        methods {
            supply   => restrict_to: [OWNER];
            borrow   => restrict_to: [OWNER];
            withdraw => restrict_to: [OWNER];
            repay    => restrict_to: [OWNER];

            provide_liquidity => restrict_to: [OWNER];

            tick_interest              => PUBLIC;
            set_interest_tick_interval => restrict_to: [OWNER];
        }
    }

    struct Cluster {
        component: ComponentAddress, // Address of the cluster component

        resource: ResourceAddress, // Resource that the cluster contains
        liquidity: Vault,          // Vault that holds liquidity

        supply: PreciseDecimal,          // Number of supply units issued
        virtual_supply: PreciseDecimal,  // Adjustable value of the supply units
        supply_manager: ResourceManager, // Manager for the supply units

        debt: PreciseDecimal,         // Number of debt units issued
        virtual_debt: PreciseDecimal, // Adjustable value of the supply units

        apr: PreciseDecimal, // The interest rate, updated at interest_tick_interval
        apr_ticked: i64,     // Last time the interest rate was ticked

        // Settings
        // price_update_interval: i64,  // Interval (in minutes) between price updates
        interest_tick_interval: i64, // Interval (in minutes) between interest ticks
    }

    impl Cluster {
        pub fn instantiate(resource: ResourceAddress, cluster_owner_rule: AccessRule) -> Global<Cluster> {
            // Reserve component address
            let (address_reservation, component_address) = Runtime::allocate_component_address(Cluster::blueprint_id());

            //. Sanity checks
            let resource_manager = ResourceManager::from_address(resource);
            assert!(
                resource_manager.resource_type().is_fungible(),
                "Resource must be fungible, provided {:?}",
                resource
            );

            let resource_name: String = resource_manager
                .get_metadata("name")
                .expect(format!("Couldn't get metadata (name) for {:?}", resource).as_str())
                .expect(format!("Metadata (name) for {:?} was none", resource).as_str());
            let resource_symbol: String = resource_manager
                .get_metadata("symbol")
                .expect(format!("Couldn't get metadata (symbol) for {:?}", resource).as_str())
                .expect(format!("Metadata (symbol) for {:?} was none", resource).as_str());

            //. Authorization
            let component_access_rule = rule!(require(global_caller(component_address)));

            let cluster_owner = OwnerRole::Fixed(cluster_owner_rule);

            //. Internal state setup
            // Setup supply unit
            let supply_unit_manager = ResourceBuilder::new_fungible(cluster_owner.clone())
                .metadata(metadata! {
                    roles {
                        metadata_setter         => OWNER;
                        metadata_setter_updater => OWNER;
                        metadata_locker         => OWNER;
                        metadata_locker_updater => rule!(deny_all);
                    },
                    init {
                        "name"   => format!("Lattic3 {}", resource_name), locked;
                        "symbol" => format!("$lt3{}", resource_symbol), locked;
                    }
                })
                .divisibility(DIVISIBILITY_MAXIMUM)
                .burn_roles(burn_roles! {
                    burner         => component_access_rule.clone();
                    burner_updater => rule!(deny_all);
                })
                .mint_roles(mint_roles! {
                    minter         => component_access_rule.clone();
                    minter_updater => rule!(deny_all);
                })
                // ! May want to remove recall_roles; currently hypothesised to be used for liquidation
                .recall_roles(recall_roles! {
                    recaller         => component_access_rule;
                    recaller_updater => rule!(deny_all);
                })
                .create_with_no_initial_supply();

            let component_state = Cluster {
                component: component_address,
                resource,
                liquidity: Vault::new(resource),
                supply: PreciseDecimal::zero(),
                virtual_supply: PreciseDecimal::zero(),
                supply_manager: supply_unit_manager,
                debt: PreciseDecimal::zero(),
                virtual_debt: PreciseDecimal::zero(),
                apr: PreciseDecimal::zero(),
                apr_ticked: 0,
                interest_tick_interval: 2,
            };

            //. Instantiate the component
            let name = format!("Lattic3 {} Cluster", resource_symbol);
            let description = format!("Cluster for the Lattic3 lending platform. Holds {}", resource_name);

            let component_metadata = metadata! {
                roles {
                    metadata_setter         => OWNER;
                    metadata_setter_updater => OWNER;
                    metadata_locker         => OWNER;
                    metadata_locker_updater => rule!(deny_all);
                },
                init {
                    "name"        => name, locked;
                    "description" => description, locked;
                }
            };

            let component = component_state
                .instantiate()
                .prepare_to_globalize(cluster_owner)
                // / .roles(component_roles)
                .metadata(component_metadata)
                .with_address(address_reservation)
                .globalize();

            component
        }

        pub fn supply(&mut self, supply: Bucket) -> Bucket {
            self.__validate_res_bucket(&supply);

            info!("Supplying [{:?} : {:?}]", supply.resource_address(), supply.amount());

            let supply_ratio: PreciseDecimal = self.supply.checked_div(self.virtual_supply).unwrap();
            let amount: PreciseDecimal = supply.amount().into();

            // TODO: Validate that the cluster is ready to accept supply

            let unit_amount = amount.checked_mul(supply_ratio).unwrap();
            // Mint corresponding number of units
            let units = self.supply_manager.mint(
                unit_amount
                    .checked_truncate(RoundingMode::ToNearestMidpointToEven)
                    .unwrap(),
            );

            // Update internal state
            self.supply = self.supply.checked_add(unit_amount).unwrap();
            self.virtual_supply = self.virtual_supply.checked_add(amount).unwrap();

            // Return units
            info!("Received units: {}", units.amount());
            units
        }

        pub fn withdraw(&mut self, units: Bucket) -> Bucket {
            self.__validate_unit_bucket(&units);

            let supply_ratio: PreciseDecimal = self.supply.checked_div(self.virtual_supply).unwrap();
            let unit_amount: PreciseDecimal = units.amount().into();

            // TODO: Validate that the cluster is ready to withdraw

            let amount = unit_amount.checked_div(supply_ratio).unwrap();
            let withdrawn = self
                .liquidity
                .take(amount.checked_truncate(RoundingMode::ToNearestMidpointToEven).unwrap());

            // Update internal state
            self.supply = self.supply.checked_sub(unit_amount).unwrap();
            self.virtual_supply = self.virtual_supply.checked_sub(amount).unwrap();

            // Return resource
            info!(
                "Withdrew [{:?} : {:?}]",
                withdrawn.resource_address(),
                withdrawn.amount()
            );
            withdrawn
        }

        pub fn borrow(&mut self, amount: PreciseDecimal) {}

        pub fn repay(&mut self, repayment: Bucket) {}

        pub fn provide_liquidity(&mut self, provided: Bucket) {
            self.liquidity.put(provided);
        }

        pub fn tick_interest(&mut self) {
            let interval = now() - self.apr_ticked;

            info!(
                "Called tick_interest at {}. Last ticked at {} so interval is {}. Interest tick interval is {}.",
                now(),
                self.apr_ticked,
                interval,
                self.interest_tick_interval
            );

            if interval > self.interest_tick_interval {
                info!("Ticking interest");
                self.__tick_interest();
                self.apr_ticked = now();
            }
        }

        pub fn set_interest_tick_interval(&mut self, interval: i64) {
            assert!(interval > 0, "Interest tick interval must be greater than zero");
            self.interest_tick_interval = interval;
        }

        //. -------------- Private Methods ------------- /
        fn __validate_res_bucket(&self, bucket: &Bucket) {
            assert!(bucket.resource_address() == self.resource, "Invalid resource provided");
            assert!(bucket.amount() > dec!(0), "Provided amount must be greater than zero");
        }

        fn __validate_unit_bucket(&self, bucket: &Bucket) {
            assert!(
                bucket.resource_address() == self.supply_manager.address(),
                "Invalid unit provided"
            );
            assert!(bucket.amount() > dec!(0), "Provided amount must be greater than zero");
        }

        fn __tick_interest(&mut self) {
            let interval = now() - self.apr_ticked;
            let delta_time = PreciseDecimal::from(interval) // I / t_y
                .checked_div(PreciseDecimal::from(YEAR_IN_SECONDS))
                .unwrap();

            info!("Delta time is {}", delta_time);

            let apr_debt: PreciseDecimal = pdec!(0.1); // apr_d (= 10%)
            let apr_supply: PreciseDecimal = pdec!(0.05); // apr_s (= 5%)

            info!("APR debt is {}, APR supply is {}", apr_debt, apr_supply);

            let virtual_debt_delta = self // change to virtual_debt
                .virtual_debt
                .checked_mul(apr_debt)
                .unwrap()
                .checked_mul(delta_time)
                .unwrap();
            let virtual_supply_delta = self // change to virtual_supply
                .virtual_supply
                .checked_mul(apr_supply)
                .unwrap()
                .checked_mul(delta_time)
                .unwrap();

            info!(
                "Debt increased by {} and supply increased by {}",
                virtual_debt_delta, virtual_supply_delta
            );

            self.virtual_debt = self.virtual_debt.checked_add(virtual_debt_delta).unwrap();
            self.virtual_supply = self.virtual_supply.checked_add(virtual_supply_delta).unwrap();
        }
    }
}
