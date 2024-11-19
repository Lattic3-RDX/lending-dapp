/* ------------------ Imports ----------------- */
use crate::utils::*;
use scrypto::prelude::*;

/* ---------------- Structures ---------------- */
#[derive(ScryptoSbor, Debug, Clone)]
pub struct ClusterState {
    pub at: i64, // seconds

    pub resource: ResourceAddress,
    pub supply_unit: ResourceAddress,
    pub liquidity: Decimal,

    pub supply: PreciseDecimal,
    pub supply_units: PreciseDecimal,
    pub virtual_supply: PreciseDecimal,
    pub supply_ratio: PreciseDecimal,

    pub debt: PreciseDecimal,
    pub debt_units: PreciseDecimal,
    pub virtual_debt: PreciseDecimal,
    pub debt_ratio: PreciseDecimal,

    pub apr: PreciseDecimal,
    pub apr_ticked: i64, // seconds
}

/* ------------------ Cluster ----------------- */
#[blueprint]
mod lattic3_cluster {
    enable_method_auth! {
        roles {
            admin => updatable_by: [OWNER];
        },
        methods {
            supply   => restrict_to: [OWNER, admin];
            borrow   => restrict_to: [OWNER, admin];
            withdraw => restrict_to: [OWNER, admin];
            repay    => restrict_to: [OWNER, admin];

            get_supply_ratio  => PUBLIC;
            get_debt_ratio    => PUBLIC;
            provide_liquidity => restrict_to: [OWNER, admin];
            get_cluster_state => PUBLIC;

            tick_interest              => PUBLIC;
            set_interest_tick_interval => restrict_to: [OWNER, admin];
        }
    }

    struct Cluster {
        component: ComponentAddress, // Address of the cluster component

        resource: ResourceAddress,            // Resource that the cluster contains
        supply_unit_manager: ResourceManager, // Manager for the supply units
        liquidity: Vault,                     // Vault that holds liquidity

        supply: PreciseDecimal,         // Raw supply value, equivalent to liquidity + debt
        supply_units: PreciseDecimal,   // Number of supply units issued
        virtual_supply: PreciseDecimal, // Adjustable value of the supply units

        debt: PreciseDecimal,         // Raw debt value
        debt_units: PreciseDecimal,   // Number of debt units issued
        virtual_debt: PreciseDecimal, // Adjustable value of the supply units

        apr: PreciseDecimal, // The interest rate, updated at interest_tick_interval
        apr_ticked: i64,     // Last time the interest rate was ticked

        // price_update_interval: i64,  // Interval (in minutes) between price updates
        interest_tick_interval: i64, // Interval (in minutes) between interest ticks
    }

    impl Cluster {
        pub fn instantiate(
            resource: ResourceAddress,
            cluster_owner_rule: AccessRule,
            cluster_admin_rule: AccessRule,
        ) -> Global<Cluster> {
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
                supply_unit_manager,
                liquidity: Vault::new(resource),

                supply: PreciseDecimal::zero(),
                supply_units: PreciseDecimal::zero(),
                virtual_supply: PreciseDecimal::zero(),

                debt: PreciseDecimal::zero(),
                debt_units: PreciseDecimal::zero(),
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

            let component_roles = roles! {
                admin => cluster_admin_rule;
            };

            let component = component_state
                .instantiate()
                .prepare_to_globalize(cluster_owner)
                .roles(component_roles)
                .metadata(component_metadata)
                .with_address(address_reservation)
                .globalize();

            component
        }

        //. ------------ Position Operations ----------- /
        pub fn supply(&mut self, supply: Bucket) -> Bucket {
            self.__validate_res_bucket(&supply);

            info!("Supplying [{:?} : {:?}]", supply.resource_address(), supply.amount());

            let supply_ratio: PreciseDecimal = self.get_supply_ratio();
            let amount: PreciseDecimal = supply.amount().into();

            // TODO: Validate that the cluster is ready to accept supply

            self.liquidity.put(supply);

            // Mint corresponding number of units
            let unit_amount = amount.checked_mul(supply_ratio).unwrap();
            let units = self.supply_unit_manager.mint(trunc(unit_amount));

            // Update internal state
            self.supply = self.supply.checked_add(amount).unwrap();
            self.supply_units = self.supply_units.checked_add(unit_amount).unwrap();
            self.virtual_supply = self.virtual_supply.checked_add(amount).unwrap();

            // TODO: Verify internal state is legal

            self.__tick_interest(); // Internal call to bypass interest_tick_interval

            // Return units
            info!("Received units: {}", units.amount());
            units
        }

        pub fn withdraw(&mut self, units: Bucket) -> Bucket {
            self.__validate_unit_bucket(&units);

            info!("Withdrawing [{:?} : {:?}]", units.resource_address(), units.amount());

            let supply_ratio: PreciseDecimal = self.get_supply_ratio();
            let unit_amount: PreciseDecimal = units.amount().into();

            // TODO: Validate that the cluster is ready to withdraw

            let amount = unit_amount.checked_div(supply_ratio).unwrap();
            let withdrawn = self.liquidity.take(trunc(amount));

            // Update internal state
            self.supply = self.supply.checked_sub(amount).unwrap();
            self.supply_units = self.supply_units.checked_sub(unit_amount).unwrap();
            self.virtual_supply = self.virtual_supply.checked_sub(amount).unwrap();

            // TODO: Verify internal state is legal

            self.__tick_interest(); // Internal call to bypass interest_tick_interval

            // Return resource
            info!(
                "Withdrawn [{:?} : {:?}]",
                withdrawn.resource_address(),
                withdrawn.amount()
            );
            withdrawn
        }

        pub fn borrow(&mut self, amount: PreciseDecimal) -> (Bucket, PreciseDecimal) {
            assert!(amount > pdec!(0), "Borrowed amount must be greater than zero");

            let debt_ratio = self.get_debt_ratio();
            let unit_amount = amount.checked_mul(debt_ratio).unwrap();

            // TODO: Validate that the cluster is ready to accept borrow

            let borrowed = self.liquidity.take(trunc(amount));

            // Update internal state
            self.debt = self.debt.checked_add(amount).unwrap();
            self.debt_units = self.debt_units.checked_add(unit_amount).unwrap();
            self.virtual_debt = self.virtual_debt.checked_add(amount).unwrap();

            // TODO: Verify internal state is legal

            self.__tick_interest(); // Internal call to bypass interest_tick_interval

            // Return resource
            info!("Borrowed [{:?} : {:?}]", borrowed.resource_address(), borrowed.amount());
            info!("Debt units: {}", unit_amount);

            (borrowed, unit_amount)
        }

        pub fn repay(&mut self, repayment: Bucket) -> PreciseDecimal {
            self.__validate_res_bucket(&repayment);

            info!(
                "Repaying [{:?} : {:?}]",
                repayment.resource_address(),
                repayment.amount()
            );

            let amount = repayment.amount();
            let debt_ratio = self.get_debt_ratio();
            let unit_amount = amount.checked_mul(debt_ratio).unwrap();

            // TODO: Validate that the cluster is ready to accept repayment

            self.liquidity.put(repayment);

            // Update internal state
            self.debt = self.debt.checked_sub(amount).unwrap();
            self.debt_units = self.debt_units.checked_sub(unit_amount).unwrap();
            self.virtual_debt = self.virtual_debt.checked_sub(amount).unwrap();

            // TODO: Verify internal state is legal

            self.__tick_interest(); // Internal call to bypass interest_tick_interval

            // Return repaid pool units
            unit_amount
        }

        //. ------------ Cluster Management ------------ /
        pub fn get_supply_ratio(&self) -> PreciseDecimal {
            if self.virtual_supply == pdec!(0) {
                pdec!(1)
            } else {
                self.supply_units.checked_div(self.virtual_supply).unwrap()
            }
        }

        pub fn get_debt_ratio(&self) -> PreciseDecimal {
            if self.virtual_debt == pdec!(0) {
                pdec!(1)
            } else {
                self.debt_units.checked_div(self.virtual_debt).unwrap()
            }
        }

        pub fn provide_liquidity(&mut self, provided: Bucket) {
            self.liquidity.put(provided);
        }

        pub fn get_cluster_state(&self) -> ClusterState {
            let state = ClusterState {
                at: now(),

                resource: self.resource,
                supply_unit: self.supply_unit_manager.address(),
                liquidity: self.liquidity.amount(),

                supply: self.supply,
                supply_units: self.supply_units,
                virtual_supply: self.virtual_supply,
                supply_ratio: self.get_supply_ratio(),

                debt: self.debt,
                debt_units: self.debt_units,
                virtual_debt: self.virtual_debt,
                debt_ratio: self.get_debt_ratio(),

                apr: self.apr,
                apr_ticked: self.apr_ticked,
            };

            info!("Cluster state: {:#?}", state);
            state
        }

        //. --------- Internal State Management -------- /
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
                bucket.resource_address() == self.supply_unit_manager.address(),
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
