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

export default function position_supply_rtm({
  component,
  account,
  position_badge_address,
  position_badge_local_id,
  assets,
}: ManifestArgs) {
  // Bucket fetch transaction manifests
  let asset_buckets = "";
  let bucket_vec = "";

  assets.forEach((asset) => {
    // Fetch buckets for each asset
    asset_buckets += `
CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${asset.address}")
    Decimal("${asset.amount}");

TAKE_FROM_WORKTOP
    Address("${asset.address}")
    Decimal("${asset.amount}")
    Bucket("bucket_${asset.address}");

    `;
    // Append each bucket to the vec
    bucket_vec += `Bucket("bucket_${asset.address}"), `;
  });

  const rtm = `
CALL_METHOD
    Address("${account}")
    "create_proof_of_non_fungibles"
    Address("${position_badge_address}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"));

POP_FROM_AUTH_ZONE
    Proof("position_proof");

${asset_buckets}

CALL_METHOD
  Address("${component}")
  "position_supply"
  Proof("position_proof")
  Array<Bucket>(${bucket_vec});

CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP");
`;

  return rtm;
}
