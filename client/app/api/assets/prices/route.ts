/* ------------------ Imports ----------------- */
import config from "@/lib/config.json";
const { priceStreamComponent } = config;
import type { NextRequest } from "next/server";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 30;

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

  try {
    // Deconstruct price stream response into prices
    const price_stream_data = await price_stream_res.json();
    const price_stream_state = price_stream_data.items[0].details.state;
    const prices = price_stream_state.fields
      .filter((field: any) => field.field_name === "prices")[0]
      .entries.map((entry: any) => ({
        asset: entry.key.value,
        price: entry.value.value,
      }));

    // Send response
    return new Response(JSON.stringify({ prices: prices }), {
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

/// Filters price stream data by assets requested in `assets[]`
export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  const body = await req.json();

  // Ensure requested assets are in an array
  if (!Array.isArray(body.assets)) {
    return new Response("Invalid request body", { status: 400 });
  }

  // Fetch price stream data
  url.pathname = "api/assets/prices";
  const prices_res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  // Ensure price stream entity details are ok
  if (!prices_res.ok) {
    return new Response("Failed to fetch data", { status: 500 });
  }

  const { prices } = await prices_res.json();

  // Filter prices by requested assets
  const filteredPrices = prices.filter((price: any) => body.assets.includes(price.asset));

  return new Response(JSON.stringify({ prices: filteredPrices }), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
