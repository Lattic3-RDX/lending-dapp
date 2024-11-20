/* ------------------ Imports ----------------- */
import type { NextRequest } from "next/server";
import { rdt, gatewayApi } from "@/lib/radix";

/* ------------------- Setup ------------------ */
// Force caching
export const dynamic = "force-dynamic";
export const revalidate = 20;

/* ------------------ Endpoints ----------------- */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const url = request.nextUrl.clone();
  const slug: string = (await params).slug;

  if (!rdt || !gatewayApi) {
    return new Response("Invalid Radix connection", { status: 200 });
  }

  // Only accept account_* slugs
  if (!slug.startsWith("account_")) {
    return new Response("Invalid slug", { status: 400 });
  }

  return new Response(JSON.stringify({ address: slug }), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
}
