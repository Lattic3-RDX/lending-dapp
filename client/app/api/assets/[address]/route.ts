/* ------------------ Imports ----------------- */
import type { NextRequest } from "next/server";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 20;

/* ------------------ Endpoints ----------------- */
export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const url = request.nextUrl.clone();
  const address: string = (await params).address;

  // Only accept resource_* slugs
  if (!address.startsWith("resource_")) {
    return new Response("Invalid slug", { status: 400 });
  }

  // Fetch asset details
  const details_res = await fetch("https://babylon-stokenet-gateway.radixdlt.com/state/entity/details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [address],
      aggregation_level: "Global",
      opt_ins: {},
    }),
  });
  const details = await details_res.json();

  if (!details_res.ok) {
    return new Response("Failed to fetch entity metadata", { status: 500 });
  }

  // Extract metadata
  const metadata_keys = ["name", "symbol", "icon_url", "description"]; // Key fields of the metadata properties we want to get the values of

  const metadata: any = details.items[0].metadata.items
    .filter((entry: any) => metadata_keys.includes(entry.key))
    .map((entry: any) => ({ [entry.key]: entry.value.programmatic_json.fields[0].value }))
    .reduce((acc: any, entry: any) => ({ ...acc, ...entry }), {});
  const { name, symbol, icon_url, description } = metadata;

  if (!name || !symbol || !icon_url || !description) {
    return new Response("Failed to fetch entity metadata", { status: 500 });
  }

  // Fetch price
  url.pathname = "api/assets/prices";
  const price_res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ assets: [address] }),
  });
  const price = await price_res.json().then((res: any) => res.prices[0].price);

  // Generate response
  const res = {
    address: address,

    name: name,
    symbol: symbol,
    icon_url: icon_url,
    // description: description,

    price: price,
  };

  return new Response(JSON.stringify(res), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
