interface ManifestArgs {
  component: string;

  account: string;
  position_badge_address: string; // resource_...
  position_badge_local_id: string; // e.g. #1#

  assets: Asset[]; // tracked assets
}

interface Asset {
  address: string;
  amount: string;
}

export default function position_borrow_rtm({
  component,
  account,
  position_badge_address,
  position_badge_local_id,
  assets,
}: ManifestArgs) {
  // Bucket fetch transaction manifests
  let asset_entry = "";
  // Manual 'deposit' call for each asset
  let asset_deposit = "";

  assets.forEach((asset) => {
    // Get hashmap entry for the asset
    asset_entry += `
    Address("${asset.address}") => Decimal("${asset.amount}"),`;

    asset_deposit += `
TAKE_FROM_WORKTOP
    Address("${asset.address}")
    Decimal("${asset.amount}")
    Bucket("bucket_${asset.address}");

CALL_METHOD
    Address("${account}")
    "deposit"
    Bucket("bucket_${asset.address}");
`;
  });

  const rtm = `
CALL_METHOD
    Address("${account}")
    "create_proof_of_non_fungibles"
    Address("${position_badge_address}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"));

POP_FROM_AUTH_ZONE
    Proof("position_proof");

CALL_METHOD
  Address("${component}")
  "position_borrow"
  Proof("position_proof")
  Map<Address, Decimal>(${asset_entry}
  );

${asset_deposit}
`;

  return rtm;
}
