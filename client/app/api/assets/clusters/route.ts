/* ------------------ Imports ----------------- */
import config from "@/lib/config.json";
const { priceStreamComponent } = config;
import type { NextRequest } from "next/server";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 20;

/* ----------------- Endpoints ---------------- */
/// Get price stream data for all assets
export async function GET() {
  // Fetch price stream data
  const price_stream_res = await fetch("https://babylon-stokenet-gateway.radixdlt.com/state/entity/details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [priceStreamComponent],
      aggregation_level: "Vault",
      opt_ins: {
        ancestor_identities: false,
        component_royalty_config: false,
        component_royalty_vault_balance: false,
        package_royalty_vault_balance: false,
        non_fungible_include_nfids: false,
        dapp_two_way_links: false,
        native_resource_details: false,
        explicit_metadata: [],
      },
    }),
  });

  // Ensure price stream entity details are ok
  if (!price_stream_res.ok) {
    return new Response("Failed to fetch data", { status: 500 });
  }
}

/// Filters price stream data by assets requested in `assets[]`
export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  const body: any = await req.json();
}
