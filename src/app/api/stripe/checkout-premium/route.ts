import { NextResponse } from "next/server";
import { getAppUrlEnv, getStripeEnv } from "@/lib/server/env";
import { getStripeServer } from "@/lib/server/stripe";

export const runtime = "nodejs";

function getBaseUrl(req: Request) {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;

  const { baseUrl, appUrl, siteUrl } = getAppUrlEnv();
  const fallback = baseUrl || appUrl || siteUrl;
  if (fallback && fallback.startsWith("http")) return fallback;

  throw new Error("Base URL is missing");
}

export async function POST(req: Request) {
  try {
    const stripe = getStripeServer();
    const baseUrl = getBaseUrl(req);
    const body = await req.json().catch(() => ({} as any));
    const uid = typeof body?.uid === "string" ? body.uid : "";

    if (!uid) return NextResponse.json({ error: "uid missing" }, { status: 400 });

    const { premiumPriceId } = getStripeEnv();
    if (!premiumPriceId) {
      return NextResponse.json({ error: "Missing STRIPE_PREMIUM_PRICE_ID" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: premiumPriceId, quantity: 1 }],
      client_reference_id: uid,
      metadata: { uid },
      subscription_data: {
        metadata: { uid },
      },
      success_url: `${baseUrl}/plans/success`,
      cancel_url: `${baseUrl}/plans`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "stripe error" }, { status: 500 });
  }
}
