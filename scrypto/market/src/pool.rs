/* ------------------ Imports ----------------- */
use scrypto::prelude::*;

/* ------------------- Pool ------------------- */
// TODO: extract into separate global component
pub type TPool = Global<OneResourcePool>;

#[derive(ScryptoSbor, Clone, Debug)]
pub struct Pool {
    pub component: TPool,
    pub address: ComponentAddress,

    pub owner_address: ResourceAddress,

    pub pool_unit: ResourceAddress,
    pub pool_unit_global: GlobalAddress,
}

impl Pool {
    pub fn new(component: TPool, address: ComponentAddress, owner_address: ResourceAddress, pool_unit: ResourceAddress, pool_unit_global: GlobalAddress) -> Self {
        Pool { component, address, owner_address, pool_unit, pool_unit_global }
    }

    /// Create a pool for a given asset; automatically sets metadata
    // ! Assumes that the pool_owner is the actual desired OwnerRole for the component
    pub fn create(pool_owner: ResourceAddress, pool_manager: AccessRule, asset: ResourceAddress) -> Pool {
        info!("[create_pool] Creating pool for asset: {:?}", asset);

        //. Sanity checks
        assert!(asset.is_fungible(), "Asset with address {:?} is not fungible", asset);

        //. Create the pool
        // let pool_owner = OwnerRole::Fixed(rule!(require(owner_badge.resource_address())));
        let pool = Blueprint::<OneResourcePool>::instantiate(OwnerRole::Fixed(rule!(require(pool_owner))), pool_manager, asset, None);
        let pool_metadata_pu: Option<GlobalAddress> = pool.get_metadata("pool_unit").expect("Unable to get pool unit address");

        // let pool_name: Option<String> = pool.get_metadata("name").unwrap_or(Some(String::from("Unable to Fetch Name")));
        // let pool_description: Option<String> = pool.get_metadata("description").unwrap_or(Some(String::from("Unable to Fetch Description")));

        // info!("[create_pool] Pool name: {:?}", pool_name);
        // info!("[create_pool] Pool description: {:?}", pool_description);

        let pool_unit_global: GlobalAddress = pool_metadata_pu.expect("Unable to get pool unit GlobalAddress");
        let pool_unit_addr: ResourceAddress = ResourceAddress::try_from(pool_unit_global).expect("Unable to get pool unit ResourceAddress");

        //. Output
        Pool::new(pool, pool.address(), pool_owner, pool_unit_addr, pool_unit_global)
    }

    pub fn set_pool_unit_metadata(&self, owner_badge: Bucket, name: String, symbol: String) -> Bucket {
        // Sanity checks
        assert_eq!(owner_badge.amount(), dec!(1), "Owner badge must be provided");
        assert_eq!(self.owner_address, owner_badge.resource_address(), "Owner badge must be provided");

        // Set pool unit metadata
        let pool_unit_rm: ResourceManager = ResourceManager::from_address(self.pool_unit.clone());

        let meta_name = format!("Lattic3 {name} Pool Unit").to_string();
        let meta_symbol = format!("$rrt{symbol}").to_string();
        let meta_description = format!("Lattic3 pool unit for the {symbol} pool").to_string();

        let owner_proof = owner_badge.create_proof_of_all();
        owner_proof.authorize(|| {
            pool_unit_rm.set_metadata("name", meta_name);
            pool_unit_rm.set_metadata("symbol", meta_symbol);
            pool_unit_rm.set_metadata("description", meta_description);
        });

        owner_badge
    }
}
