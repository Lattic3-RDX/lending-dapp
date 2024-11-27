/* ------------------ Imports ----------------- */
import type { NextRequest } from "next/server";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 20;

/* ------------------ Endpoints ----------------- */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const url = request.nextUrl.clone();
  const slug: string = (await params).slug;

  // Only accept resource_* slugs
  if (!slug.startsWith("resource_")) {
    return new Response("Invalid slug", { status: 400 });
  }

  // Fetch asset metadata
  const details_res = await fetch("https://babylon-stokenet-gateway.radixdlt.com/state/entity/details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [slug],
      aggregation_level: "Global",
      opt_ins: {},
    }),
  });
  const details = await details_res.json();

  if (!details_res.ok) {
    return new Response("Failed to fetch entity metadata", { status: 500 });
  }

  // Fetch price
  url.pathname = "api/assets/prices";
  const price_res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ assets: [slug] }),
  });
  const { prices } = await price_res.json();

  const price = prices[0].price;

  return new Response(JSON.stringify({ address: slug, price: price, details: details }), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
