/* ------------------ Imports ----------------- */
use scrypto_test::prelude::*;

/* ---------------- Test Setup ---------------- */
// Test config
const LOG_TX: bool = false;

// Struct to hold account data
struct Account {
    public_key: Secp256k1PublicKey,
    private_key: Secp256k1PrivateKey,
    address: ComponentAddress,
}

impl Account {
    pub fn nf_global_id(&self) -> NonFungibleGlobalId {
        NonFungibleGlobalId::from_public_key(&self.public_key)
    }
}

/// Log transaction with name [func]
fn log_tx(func: &str, tx: &TransactionReceiptV1) {
    if LOG_TX {
        println!("[{}] Transaction Receipt:\n{}\n", func, tx.display(&AddressBech32Encoder::for_simulator()));
    }
}

/* ------------- Helper Manifests ------------- */
/// Initialise default state for unit tests
fn setup() -> (
    LedgerSimulator<NoExtension, InMemorySubstateDatabase>, // Ledger simulation
    PackageAddress,                                         // Package
    ComponentAddress,                                       // Lattic3
    (Account, Account),                                     // Accounts: Main, User 1
    ResourceAddress,                                        // Owner Badge
) {
    //. Simulation Setup
    let mut ledger: LedgerSimulator<NoExtension, InMemorySubstateDatabase> = LedgerSimulatorBuilder::new().build();

    //. Account Setup
    // Main Account
    let (public_key, private_key, account) = ledger.new_allocated_account();
    let main_account = Account { public_key, private_key, address: account };
    // User 1
    let (public_key, private_key, account) = ledger.new_allocated_account();
    let user_account = Account { public_key, private_key, address: account };

    //. Create additional resources
    let hug: ResourceAddress = create_fungible(&mut ledger, dec!(10000), "HUG", &main_account);
    let usdc: ResourceAddress = create_fungible(&mut ledger, dec!(10000), "USDC", &main_account);
    let weth: ResourceAddress = create_fungible(&mut ledger, dec!(10000), "wETH", &main_account);

    //. Package Setup
    let package_address = ledger.compile_and_publish(this_package!()); // Publish package

    // Instantiate component (Lattic3)
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .call_function(
            package_address,
            "Lattic3",
            "instantiate",
            manifest_args!(main_account.address.clone(), vec![hug, usdc, weth]), // ! REMOVE VECTOR WHEN NOT ON DEVNET
        )
        .deposit_batch(main_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("instantise", &receipt);
    receipt.expect_commit_success();

    let component = receipt.expect_commit(true).new_component_addresses()[0];
    let owner_badge = receipt.expect_commit(true).new_resource_addresses()[0];

    // // add_asset HUG
    // add_asset(&mut ledger, component, hug, &main_account, owner_badge);
    // // add_asset USDC
    // add_asset(&mut ledger, component, usdc, &main_account, owner_badge);
    // // add_asset wETH
    // add_asset(&mut ledger, component, weth, &main_account, owner_badge);

    //. Return
    (ledger, package_address, component, (main_account, user_account), owner_badge)
}

fn create_fungible(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>, amount: Decimal, name: &str, owner_account: &Account) -> ResourceAddress {
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

fn add_asset(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>, component: ComponentAddress, address: ResourceAddress, owner_account: &Account, owner_badge: ResourceAddress) {
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .create_proof_from_account_of_amount(owner_account.address, owner_badge, dec!(1))
        .call_method(component, "add_asset", manifest_args!(address))
        .deposit_batch(owner_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![owner_account.nf_global_id()]);

    log_tx("add_asset", &receipt);
    receipt.expect_commit_success();
}

fn log_asset_list(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>, component: ComponentAddress, caller: &Account) {
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .call_method(component, "log_asset_list", manifest_args!())
        .deposit_batch(caller.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![caller.nf_global_id()]);

    log_tx("log_asset_list", &receipt);
    receipt.expect_commit_success();
}

fn log_assets(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>, component: ComponentAddress, caller: &Account) {
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .call_method(component, "log_assets", manifest_args!())
        .deposit_batch(caller.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![caller.nf_global_id()]);

    log_tx("log_assets", &receipt);
    receipt.expect_commit_success();
}

// fn log_pools(ledger: &mut LedgerSimulator<NoExtension, InMemorySubstateDatabase>, component: ComponentAddress, caller: &Account) {
//     let manifest = ManifestBuilder::new()
//         .lock_fee_from_faucet()
//         .call_method(component, "log_pools", manifest_args!())
//         .deposit_batch(caller.address)
//         .build();
//     let receipt = ledger.execute_manifest(manifest, vec![caller.nf_global_id()]);

//     log_tx("log_pools", &receipt);
//     receipt.expect_commit_success();
// }

/* ------------------- Tests ------------------ */
/// Basic test to check that Lattic3 instantises correctly
#[test]
fn instantisation_test() -> Result<(), RuntimeError> {
    // Deconstruct setup
    let (mut ledger, _, component, (main_account, user_account), owner_badge) = setup();

    log_asset_list(&mut ledger, component, &main_account);
    log_assets(&mut ledger, component, &main_account);
    // log_pools(&mut ledger, component, &main_account);

    Ok(())
}

/// Tests that a fungible asset can be added when everything is valid
#[test]
fn asset_add_test() -> Result<(), RuntimeError> {
    // Deconstruct setup
    let (mut ledger, _, component, (main_account, _), owner_badge) = setup();

    // Create dummy asset
    let dummy_asset = ledger.create_fungible_resource(dec!(10000), DIVISIBILITY_MAXIMUM, main_account.address);
    println!("Created Assets:\n- Dummy Asset: {:?}\n", dummy_asset);

    // Valid addition
    #[rustfmt::skip]
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
        .call_method(
            component,
            "add_asset",
            manifest_args!(dummy_asset)
        )
        .deposit_batch(main_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("add_asset:valid", &receipt);
    receipt.expect_commit_success();

    // Test that component has the correct number of resources
    let resources = ledger.get_component_resources(component);

    println!("Resources: {:#?}", resources);
    assert!(&resources.contains_key(&dummy_asset), "Added resource not found");

    Ok(())
}

/// Tests that a fungible asset cannot be added when perms are incorrect
#[test]
fn asset_add_noperm_test() -> Result<(), RuntimeError> {
    // Deconstruct setup
    let (mut ledger, _, component, (main_account, user_account), _) = setup();

    // Create dummy asset
    let dummy_asset = ledger.create_fungible_resource(dec!(10000), DIVISIBILITY_MAXIMUM, main_account.address);
    println!("Created Assets:\n- Dummy Asset: {:?}\n", dummy_asset);

    // Invalid addition; invalid permission for 'user_account'
    #[rustfmt::skip]
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .call_method(
            component,
            "add_asset",
            manifest_args!(dummy_asset)
        )
        .deposit_batch(user_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![user_account.nf_global_id()]);

    log_tx("add_asset:invalid", &receipt);
    receipt.expect_commit_failure();

    Ok(())
}

/// Tests that a fungible asset can be removed when everything is valid
#[test]
fn asset_remove_test() -> Result<(), RuntimeError> {
    // Deconstruct setup
    let (mut ledger, _, component, (main_account, _), owner_badge) = setup();

    // Create dummy asset
    let dummy_asset = ledger.create_fungible_resource(dec!(10000), DIVISIBILITY_MAXIMUM, main_account.address);
    println!("Created Assets:\n- Dummy Asset: {:?}\n", dummy_asset);

    //. Add asset
    // Valid addition
    #[rustfmt::skip]
        let manifest = ManifestBuilder::new()
            .lock_fee_from_faucet()
            .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
            .call_method(
                component,
                "add_asset",
                manifest_args!(dummy_asset)
            )
            .deposit_batch(main_account.address)
            .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("add_asset:valid", &receipt);
    receipt.expect_commit_success();

    //. Remove asset
    // Valid removal
    #[rustfmt::skip]
    let manifest = ManifestBuilder::new()
        .lock_fee_from_faucet()
        .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
        .call_method(
            component,
            "remove_asset",
            manifest_args!(dummy_asset)
        )
        .deposit_batch(main_account.address)
        .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("remove_asset", &receipt);
    receipt.expect_commit_success();

    // ! Can't check the asset_list state, or at least I can't find a way to access it for now
    // Test that component has the correct number of resources
    // let resources = ledger.get_component_resources(component);

    // println!("Resources: {:#?}", resources);
    // assert!(!&resources.contains_key(&dummy_asset), "Added resource found after removal");

    Ok(())
}

/// Tests that a fungible asset cannot be removed when perms are incorrect
#[test]
fn asset_remove_noperm_test() -> Result<(), RuntimeError> {
    // Deconstruct setup
    let (mut ledger, _, component, (main_account, user_account), owner_badge) = setup();

    // Create dummy asset
    let dummy_asset = ledger.create_fungible_resource(dec!(10000), DIVISIBILITY_MAXIMUM, main_account.address);

    // Add asset
    #[rustfmt::skip]
        let manifest = ManifestBuilder::new()
            .lock_fee_from_faucet()
            .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
            .call_method(
                component,
                "add_asset",
                manifest_args!(dummy_asset)
            )
            .deposit_batch(main_account.address)
            .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("add_asset:valid", &receipt);
    receipt.expect_commit_success();

    let resources = ledger.get_component_resources(component);
    assert!(resources.contains_key(&dummy_asset), "Added resource not found");

    // Remove asset with a user who doesn't have the necessary badge
    #[rustfmt::skip]
        let manifest = ManifestBuilder::new()
            .lock_fee_from_faucet()
            .call_method(
                component,
                "remove_asset",
                manifest_args!(dummy_asset)
            )
            .deposit_batch(user_account.address)
            .build();
    let receipt = ledger.execute_manifest(manifest, vec![user_account.nf_global_id()]);

    log_tx("remove_asset:noperm", &receipt);
    receipt.expect_commit_failure();

    Ok(())
}

/// Tests that the program correctly panics when a fungible asset that doesn't exist is removed
#[test]
fn asset_remove_invalid_test() -> () {
    // Deconstruct setup
    let (mut ledger, _, component, (main_account, _), owner_badge) = setup();

    // Create dummy asset
    let dummy_asset = ledger.create_fungible_resource(dec!(10000), DIVISIBILITY_MAXIMUM, main_account.address);

    // Invalid removal; 'invalid_asset' not added
    #[rustfmt::skip]
        let manifest = ManifestBuilder::new()
            .lock_fee_from_faucet()
            .create_proof_from_account_of_amount(main_account.address, owner_badge, dec!(1))
            .call_method(
                component,
                "remove_asset",
                manifest_args!(dummy_asset)
            )
            .deposit_batch(main_account.address)
            .build();
    let receipt = ledger.execute_manifest(manifest, vec![main_account.nf_global_id()]);

    log_tx("remove_asset:invalid", &receipt);
    receipt.expect_commit_failure();
}
