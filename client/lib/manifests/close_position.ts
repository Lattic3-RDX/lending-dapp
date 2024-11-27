interface ManifestArgs {
  component: string;

  account: string;
  position_badge_address: string; // resource_...
  position_badge_local_id: string; // e.g. #1#
}

export default function position_close_rtm({
  component,
  account,
  position_badge_address,
  position_badge_local_id,
}: ManifestArgs) {
  // Open position manifest
  const rtm = `
CALL_METHOD
    Address("${account}")
    "withdraw_non_fungibles"
    Address("${position_badge_address}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"));

TAKE_NON_FUNGIBLES_FROM_WORKTOP
    Address("${position_badge_address}")
    Array<NonFungibleLocalId>(NonFungibleLocalId("${position_badge_local_id}"))
    Bucket("position_bucket");

CALL_METHOD
    Address("${component}")
    "close_position"
    Bucket("position_bucket");

CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP");
`;

  return rtm;
}
