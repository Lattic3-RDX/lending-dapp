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

  // Fetch price
  url.pathname = "api/assets/prices";
  const price_res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ assets: [slug] }),
  });
  const { prices } = await price_res.json();
  const price = prices[0].price;

  return new Response(JSON.stringify({ address: slug, price: price }), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
