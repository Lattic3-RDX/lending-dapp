/* ------------------ Imports ----------------- */
import { priceStreamComponent } from "@/lib/config.json";

/* ------------------- Setup ------------------ */
// Force caching
// export const dynamic = "force-dynamic";
// export const revalidate = 60;

/* ----------------- Endpoints ---------------- */
export async function GET() {
  const fetch_res = await fetch("https://babylon-stokenet-gateway.radixdlt.com/state/entity/details", {
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

  if (fetch_res.status !== 200) {
    return new Response("Failed to fetch data", { status: 500 });
  }

  try {
    const data = await fetch_res.json();
    const state = data.items[0].details.state;
    const prices = state.fields
      .filter((field: any) => field.field_name === "prices")[0]
      .entries.map((entry: any) => ({
        asset: entry.key.value,
        price: entry.value.value,
      }));

    const res = {
      prices: prices,
    };

    return new Response(JSON.stringify(res), {
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
