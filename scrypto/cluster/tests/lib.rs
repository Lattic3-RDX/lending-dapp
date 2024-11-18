/* ------------------ Imports ----------------- */
use scrypto_test::prelude::*;

/* ---------------- Test Setup ---------------- */
// Test config
const LOG_TX: bool = true;

// Struct to hold account data
struct Account {
    public_key: Secp256k1PublicKey,
    private_key: Secp256k1PrivateKey,
    address: ComponentAddress,
}

impl Account {
    pub fn new(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>) -> Self {
        let (public_key, private_key, address) = ledger.new_allocated_account();
        Account { public_key, private_key, address }
    }

    pub fn nf_global_id(&self) -> NonFungibleGlobalId {
        NonFungibleGlobalId::from_public_key(&self.public_key)
    }
}

/// Log transaction with name [func]
fn log_tx(func: &str, tx: &TransactionReceiptV1) {
    if LOG_TX {
        println!(
            "[{}] Transaction Receipt:\n{}\n",
            func,
            tx.display(&AddressBech32Encoder::for_simulator())
        );
    }
}

fn now(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>) -> i64 {
    ledger
        .get_current_time(TimePrecisionV2::Second)
        .seconds_since_unix_epoch
}

/* ------------- Helper Manifests ------------- */
fn instantiate(
    ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>,
    package_address: PackageAddress,
    owner_account: &Account,
    resource: ResourceAddress,
    cluster_owner_rule: AccessRule,
    cluster_admin_rule: AccessRule,
) -> (ComponentAddress, ResourceAddress) {
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .call_function(
            package_address,
            "Cluster",
            "instantiate",
            manifest_args!(resource, cluster_owner_rule, cluster_admin_rule),
        )
        .deposit_batch(owner_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![owner_account.nf_global_id()]);

    log_tx("instantiate", &receipt);
    receipt.expect_commit_success();

    let component = receipt.expect_commit(true).new_component_addresses()[0];
    let unit = receipt.expect_commit(true).new_resource_addresses()[0];

    (component, unit)
}

fn create_fungible(
    ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>,
    amount: Decimal,
    name: &str,
    owner_account: &Account,
) -> ResourceAddress {
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .create_fungible_resource(
            OwnerRole::None,
            true,
            DIVISIBILITY_MAXIMUM,
            FungibleResourceRoles::default(),
            metadata! {init {
                "name" => name, locked;
                "symbol" => name, locked;
                "description" => format!("Resource {}", name), locked;
            }},
            Some(amount),
        )
        .try_deposit_entire_worktop_or_abort(owner_account.address, None)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![]);
    receipt.expect_commit(true).new_resource_addresses()[0]
}

/* ------------------- Tests ------------------ */
/// Basic test to check that Lattic3 instantises correctly
#[test]
fn basic_test() -> Result<(), RuntimeError> {
    //. Simulation Setup
    let mut ledger: LedgerSimulator<NoExtension, InMemorySubstateDatabase> = LedgerSimulatorBuilder::new().build();

    const UNIX_2024: i64 = 1704067200;
    const SIX_MONTHS: i64 = 15811200;

    ledger.advance_to_round_at_timestamp(Round::of(1), UNIX_2024);

    //. Account Setup
    // Main Account
    let main_account = Account::new(&mut ledger);
    // User 1
    let user_account = Account::new(&mut ledger);

    //. Create additional resources
    let owner_badge = create_fungible(&mut ledger, dec!(1), "Cluster Owner Badge", &main_account);
    let admin_badge = create_fungible(&mut ledger, dec!(1), "Cluster Admin Badge", &main_account);

    let hug: ResourceAddress = create_fungible(&mut ledger, dec!(10000), "HUG", &main_account);
    let usdc: ResourceAddress = create_fungible(&mut ledger, dec!(10000), "USDC", &main_account);
    let weth: ResourceAddress = create_fungible(&mut ledger, dec!(10000), "wETH", &main_account);

    //. Package Setup
    let package_address = ledger.compile_and_publish(this_package!());

    //. Instantiate
    let (xrd_cluster, xrd_unit) = instantiate(
        &mut ledger,
        package_address,
        &main_account,
        XRD,
        rule!(require(owner_badge)),
        rule!(require(admin_badge)),
    );

    //. Provide 1k liquidity
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
        .withdraw_from_account(main_account.address, XRD, dec!(1000))
        .take_from_worktop(XRD, dec!(1000), "bucket_xrd")
        .call_method_with_name_lookup(
            xrd_cluster,
            "provide_liquidity",
            |lookup| (lookup.bucket("bucket_xrd"),),
        )
        .deposit_batch(main_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("provide_liquidity", &receipt);
    receipt.expect_commit_success();

    //. Call supply method
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
        .withdraw_from_account(main_account.address, XRD, dec!(100))
        .take_from_worktop(XRD, dec!(100), "bucket_xrd")
        .call_method_with_name_lookup(xrd_cluster, "supply", |lookup| (lookup.bucket("bucket_xrd"),))
        .deposit_batch(main_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("supply", &receipt);
    receipt.expect_commit_success();

    ledger.advance_to_round_at_timestamp(Round::of(2), UNIX_2024 + SIX_MONTHS);

    //. Call withdraw method
    println!("XRD Unit: {:?}", xrd_unit);

    Ok(())
}
