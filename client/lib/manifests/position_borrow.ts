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

  assets.forEach((asset) => {
    // Get hashmap entry for the asset
    asset_entry += `
    Address("${asset.address}") => Decimal("${asset.amount}"),`;
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

CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP");
`;

  return rtm;
}
