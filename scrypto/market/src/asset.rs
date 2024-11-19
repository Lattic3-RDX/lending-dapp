/* ------------------ Imports ----------------- */
use crate::cluster::ClusterWrapper;
use scrypto::prelude::*;

/* --------------- Asset Struct --------------- */
// TODO: Create functions to disable asset operations
#[derive(Clone, ScryptoSbor, Debug)]
pub struct AssetEntry {
    pub address: ResourceAddress,
    pub resource_manager: ResourceManager,

    pub name: String,
    pub symbol: String,

    pub cluster_wrapper: ClusterWrapper,
}

impl AssetEntry {
    /* ------------------- Inits ------------------ */
    pub fn new(address: ResourceAddress, cluster_wrapper: ClusterWrapper) -> AssetEntry {
        let resource_manager: ResourceManager = ResourceManager::from_address(address.clone());
        assert!(resource_manager.resource_type().is_fungible(), "Provided asset must be fungible.");

        // Setup resource
        let name: String = resource_manager.get_metadata("name").expect("Cannot get asset name").expect("Asset name is None");
        let symbol: String = resource_manager.get_metadata("symbol").expect("Cannot get asset symbol").expect("Asset symbol is None");
        // let description: String = resource_manager.get_metadata("description").expect("Cannot get asset description").expect("Asset description is None");

        // Setup cluster
        assert!(cluster_wrapper.resource == address, "Asset address does not match cluster's asset address");

        AssetEntry { address, resource_manager, name, symbol, cluster_wrapper }
    }
}
