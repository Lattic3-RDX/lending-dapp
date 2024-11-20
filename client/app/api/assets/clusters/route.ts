/* ------------------ Imports ----------------- */
import config from "@/lib/config.json";
const { marketComponent } = config;
import type { NextRequest } from "next/server";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 30;

const addressToResource = (address: string) => {
  return {
    kind: "Reference",
    type_name: "ResourceAddress",
    value: address,
  };
};

/* ----------------- Endpoints ---------------- */
/// Get price stream data for all assets
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Fetch asset list
  url.pathname = "api/assets";
  const assets_res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  // Ensure asset list is ok
  if (!assets_res.ok) {
    return new Response("Failed to fetch data", { status: 500 });
  }
  const { assets }: { assets: string[] } = await assets_res.json();

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

  // Fetch market state
  const market_data: any = await market_res.json();
  const market_assets_kv: any = market_data.items[0].details.state.fields.filter(
    (field: any) => field.field_name === "assets",
  )[0].value;

  // Fetch cluster addresses
  const asset_kv_keys: any[] = assets.map((asset) => ({
    key_json: addressToResource(asset),
  }));

  const asset_entry_req = await fetch("https://stokenet.radixdlt.com/state/key-value-store/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key_value_store_address: market_assets_kv,
      keys: asset_kv_keys,
    }),
  });

  const asset_entry_data = await asset_entry_req.json();
  const cluster_addresses = asset_entry_data.entries.map(
    (entry: any) =>
      entry.value.programmatic_json.fields
        .filter((field: any) => field.field_name === "cluster_wrapper")[0]
        .fields.filter((field: any) => field.field_name === "cluster")[0].value,
  );

  const cluster_states: any = {};
  for (const cluster_address of cluster_addresses) {
    const cluster_res = await fetch("https://babylon-stokenet-gateway.radixdlt.com/state/entity/details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addresses: [cluster_address],
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

    if (!cluster_res.ok) {
      return new Response("Failed to fetch data", { status: 500 });
    }

    const cluster_data: any = await cluster_res.json();
    const cluster_state_raw = cluster_data.items[0].details.state.fields;

    const resource = cluster_state_raw.filter((field: any) => field.field_name === "resource")[0].value;

    const supply = +cluster_state_raw.filter((field: any) => field.field_name === "supply")[0].value;
    const supply_units = +cluster_state_raw.filter((field: any) => field.field_name === "supply_units")[0].value;
    const virtual_supply = +cluster_state_raw.filter((field: any) => field.field_name === "virtual_supply")[0].value;
    const supply_ratio = virtual_supply <= 0 ? 1 : supply_units / virtual_supply;

    const debt = +cluster_state_raw.filter((field: any) => field.field_name === "debt")[0].value;
    const debt_units = +cluster_state_raw.filter((field: any) => field.field_name === "debt_units")[0].value;
    const virtual_debt = +cluster_state_raw.filter((field: any) => field.field_name === "virtual_debt")[0].value;
    const debt_ratio = virtual_debt <= 0 ? 1 : debt_units / virtual_debt;

    const liquidity = supply - debt;

    const cluster_state = {
      cluster: cluster_address,

      liquidity: liquidity,

      resource: resource,
      supply_unit: cluster_state_raw.filter((field: any) => field.field_name === "supply_unit_manager")[0].value,

      supply: supply,
      supply_units: supply_units,
      virtual_supply: virtual_supply,
      supply_ratio: supply_ratio,

      debt: debt,
      debt_units: debt_units,
      virtual_debt: virtual_debt,
      debt_ratio: debt_ratio,
    };

    cluster_states[resource] = cluster_state;
  }

  return new Response(JSON.stringify(cluster_states), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
