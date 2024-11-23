interface ManifestArgs {
  component: string;

  account: string;
  position_badge_address: string; // resource_...
  position_badge_local_id: string; // e.g. #1#

  asset: Asset; // tracked asset
  requested: string;
}

interface Asset {
  address: string;
  amount: string;
}

export default function position_repay_rtm({
  component,
  account,
  position_badge_address,
  position_badge_local_id,
  asset,
  requested,
}: ManifestArgs) {
  const req = requested === "None" ? "None" : `Some(Decimal("${requested}"))`;

  const rtm = `
CALL_METHOD
    Address("${account}")
    "create_proof_of_non_fungibles"
    Address("${position_badge_address}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"));

POP_FROM_AUTH_ZONE
    Proof("position_proof");

CALL_METHOD
  Address("${account}")
  "withdraw"
  Address("${asset.address}")
  Decimal("${asset.amount}");

TAKE_FROM_WORKTOP
  Address("${asset.address}")
  Decimal("${asset.amount}")
  Bucket("bucket_1");

CALL_METHOD
  Address("${component}")
  "position_repay"
  Proof("position_proof")
  Bucket("bucket_1")
  ${req};

CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP");
`;

  return rtm;
}
