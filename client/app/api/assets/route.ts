/* ------------------ Imports ----------------- */
import config from "@/lib/config.json";
const { marketComponent } = config;
import type { NextRequest } from "next/server";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 20;

/* ----------------- Endpoints ---------------- */
/// Get get the asset list
export async function GET() {
  // Fetch price stream data
  const market_res = await fetch("https://babylon-stokenet-gateway.radixdlt.com/state/entity/details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [marketComponent],
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
  if (!market_res.ok) {
    return new Response("Failed to fetch data", { status: 500 });
  }

  try {
    // Deconstruct price stream response into prices
    const market_data = await market_res.json();
    const market_state = market_data.items[0].details.state;
    const asset_list = market_state.fields.filter((field: any) => field.field_name === "asset_list")[0];

    // Send response
    return new Response(JSON.stringify({ assets: asset_list }), {
      headers: {
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response("Failed to parse data", { status: 500 });
  }
}
