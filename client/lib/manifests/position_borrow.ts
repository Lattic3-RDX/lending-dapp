interface ManifestArgs {
  component: string,

  account: string,
  position_badge_address: string,  // resource_...
  position_badge_local_id: string, // e.g. #1#

  assets: Asset[], // tracked assets
}

interface Asset {
  address: string,
  amount: number,
}

export default function position_borrow_rtm({ component, account, position_badge_address, position_badge_local_id, assets }: ManifestArgs) {
  // Bucket fetch transaction manifests
  let asset_entry = "";

  assets.forEach((asset) => {
    // Get hashmap entry for the asset
    asset_entry += `
    Address("${asset.address}") => PreciseDecimal("${asset.amount}"),`
  })

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
  Address("${component}")
  "position_borrow"
  Bucket("position_badge")
  Map<Address, PreciseDecimal>(${asset_entry}
  );

CALL_METHOD
  Address("${account}")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP");
`

  return rtm
}
