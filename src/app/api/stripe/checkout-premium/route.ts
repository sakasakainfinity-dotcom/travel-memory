import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getBaseUrl(req: Request) {
  // Vercelで安定して取れるやつを優先
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host");

  if (host) return `${proto}://${host}`;

  // 最後の保険（envがあるならそれ）
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.startsWith("http")) return envBase;

  throw new Error("Base URL is missing");
}

export async function POST(req: Request) {
  try {
    const baseUrl = getBaseUrl(req);

    const body = await req.json().catch(() => ({} as any));
    const uid = typeof body?.uid === "string" ? body.uid : "";

    if (!uid) {
      return NextResponse.json({ error: "uid missing" }, { status: 400 });
    }

    const price = process.env.STRIPE_PREMIUM_PRICE_ID;
    if (!price) {
      return NextResponse.json({ error: "STRIPE_PREMIUM_PRICE_ID missing" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      metadata: { uid }, // ★ここ大事
      success_url: `${baseUrl}/public?premium=1`,
      cancel_url: `${baseUrl}/public`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "stripe error" }, { status: 500 });
  }
}
