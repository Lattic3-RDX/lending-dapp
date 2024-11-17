/* ------------------ Imports ----------------- */
use scrypto::prelude::*;

/* ---------------- Structures ---------------- */
pub enum ClusterMetadata {}

/* ------------------ Cluster ----------------- */
#[blueprint]
mod lattic3_cluster {
    struct Cluster {
        component: ComponentAddress, // Address of the cluster component

        resource: ResourceAddress, // Resource that the cluster contains
        liquidity: Vault,          // Vault that holds liquidity

        supply: PreciseDecimal,         // Number of tokens supplied
        virtual_supply: PreciseDecimal, //

        debt: PreciseDecimal,         // Number of tokens borrowed
        virtual_debt: PreciseDecimal, // TBD

        // price_stream: Option<Global<AnyComponent>>, // Component used to fetch the resource's price
        // price: PreciseDecimal,                      // The price of the resource, updated at price_update_interval
        // price_updated: i64,                         // Last time the price was updated
        // // ------------------
        apr_rate: PreciseDecimal, // The interest rate, updated at interest_tick_interval
        apr_updated: i64,         // Last time the interest rate was updated

        // Settings
        // price_update_interval: i64,  // Interval (in minutes) between price updates
        interest_tick_interval: i64, // Interval (in minutes) between interest ticks
    }

    impl Cluster {
        // -> Global<Cluster>
        pub fn instantiate(resource: ResourceAddress, cluster_owner: OwnerRole, cluster_manager: AccessRule) -> () {}

        //. -------------- Private Methods ------------- /
        fn __tick_interest(&self) -> () {}

        fn __update_price(&self) -> () {}
    }
}
