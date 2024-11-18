interface ManifestArgs {
  component: string,
  account: string,
  assets: Asset[],
}

interface Asset {
  address: string,
  amount: number,
}

export default function open_position_rtm({ component, account, assets }: ManifestArgs) {
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

    `
    // Append each bucket to the vec
    bucket_vec += `Bucket("bucket_${asset.address}"), `
  })

  // Open position manifest
  const rtm = `
${asset_buckets}

CALL_METHOD
    Address("${component}")
    "open_position"
    Array<Bucket>(${bucket_vec});

CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP");
`

  return rtm
}
