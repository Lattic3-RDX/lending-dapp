interface ManifestArgs {
  component: string;

  account: string;
  position_badge_address: string; // resource_...
  position_badge_local_id: string; // e.g. #1#

  asset: Asset; // supply units
  required: Asset; // amount
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
  required,
}: ManifestArgs) {
  const rtm = `
CALL_METHOD
  Address("${account}")
  "withdraw_non_fungibles"
  Address("${position_badge_address}")
  Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"));

TAKE_NON_FUNGIBLES_FROM_WORKTOP
  Address("${position_badge_address}")
  Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"))
  Bucket("position_badge");

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
  "position_withdraw"
  Bucket("position_badge")
  Bucket("bucket_1");

ASSERT_WORKTOP_CONTAINS
  Address("${required.address}")
  Decimal("${required.amount}");

CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP");
`;

  return rtm;
}
