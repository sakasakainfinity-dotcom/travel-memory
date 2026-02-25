// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// サーバー専用（Service Role）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    console.log("✅ stripe event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const uid = (session.metadata?.uid ?? "").trim();
      if (!uid) {
        console.error("❌ missing uid in session.metadata");
        return NextResponse.json({ error: "missing uid in metadata" }, { status: 400 });
      }

      // 念のため profiles が無ければ作る（既存ユーザー救済）
      const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert(
        {
          id: uid,
          is_premium: true,
          premium_since: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (upsertErr) {
        console.error("❌ supabase upsert error:", upsertErr);
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }

      console.log("✅ premium updated for uid:", uid);
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("❌ webhook handler error:", e?.message);
    return NextResponse.json({ error: e?.message ?? "webhook handler error" }, { status: 500 });
  }
}
