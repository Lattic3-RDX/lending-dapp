/* ------------------ Imports ----------------- */
use crate::market::lattic3::{Cluster, ClusterFunctions};
use scrypto::prelude::*;

/* ------------------- Pool ------------------- */
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

#[derive(ScryptoSbor, Debug, Clone)]
pub enum ClusterLayer {
    Supply,
    Debt,
}

#[derive(ScryptoSbor, Debug, Clone)]
pub struct ClusterWrapper {
    pub cluster: Global<Cluster>,

    pub resource: ResourceAddress,
    pub supply_unit: ResourceAddress,
}

impl ClusterWrapper {
    pub fn new(address: ComponentAddress) -> ClusterWrapper {
        let cluster: Global<Cluster> = address.into();
        let cluster_state = cluster.get_cluster_state();

        ClusterWrapper {
            cluster,
            resource: cluster_state.resource,
            supply_unit: cluster_state.supply_unit,
        }
    }

    pub fn create(resource: ResourceAddress, cluster_owner: AccessRule, cluster_manager: AccessRule) -> ClusterWrapper {
        let cluster = Blueprint::<Cluster>::instantiate(resource, cluster_owner, cluster_manager);
        let cluster_state = cluster.get_cluster_state();

        ClusterWrapper {
            cluster,
            resource: cluster_state.resource,
            supply_unit: cluster_state.supply_unit,
        }
    }

    pub fn set_supply_unit_metadata(&self, owner_badge: Bucket, name: String, symbol: String) -> Bucket {
        let supply_manager = ResourceManager::from_address(self.supply_unit);

        owner_badge.authorize_with_all(|| {
            supply_manager.set_metadata("name", name);
            supply_manager.set_metadata("symbol", symbol);
        });

        owner_badge
    }
}
