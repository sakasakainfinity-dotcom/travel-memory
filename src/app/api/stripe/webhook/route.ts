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

function getUidFromAny(obj: any): string {
  return String(obj?.metadata?.uid ?? obj?.client_reference_id ?? "").trim();
}

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

    // ✅ 1) Checkout完了 → まず is_premium=true（最速反映）
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const uid = getUidFromAny(session);
      if (!uid) return NextResponse.json({ error: "missing uid" }, { status: 400 });

      // subscription id を保存（後で追跡）
      const subId = typeof session.subscription === "string" ? session.subscription : null;
      const customerId = typeof session.customer === "string" ? session.customer : null;

      const { error } = await supabaseAdmin.from("profiles").upsert(
        {
          id: uid,
          is_premium: true,
          premium_since: new Date().toISOString(),
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("❌ supabase upsert error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log("✅ premium updated for uid:", uid);
    }

    // ✅ 2) サブスク更新 → statusに応じて premium を調整
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;

      const uid = getUidFromAny(sub);
      // subscriptionイベントでuidが取れないケースもあるので、その場合は何もしない
      if (uid) {
        const status = sub.status; // active, trialing, past_due, canceled, unpaid など
        const premiumOk = status === "active" || status === "trialing";

        const { error } = await supabaseAdmin.from("profiles").upsert(
          {
            id: uid,
            is_premium: premiumOk,
            stripe_subscription_id: sub.id,
            stripe_customer_id: typeof sub.customer === "string" ? sub.customer : null,
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("❌ supabase upsert error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("✅ subscription updated uid:", uid, "status:", status);
      }
    }

    // ✅ 3) 解約 → premium false（これが無いと永遠にtrue）
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;

      const uid = getUidFromAny(sub);
      if (uid) {
        const { error } = await supabaseAdmin.from("profiles").upsert(
          {
            id: uid,
            is_premium: false,
            stripe_subscription_id: sub.id,
            stripe_customer_id: typeof sub.customer === "string" ? sub.customer : null,
          },
          { onConflict: "id" }
        );
        if (error) {
          console.error("❌ supabase upsert error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        console.log("✅ subscription deleted uid:", uid);
      }
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error("❌ webhook handler error:", e?.message);
    return NextResponse.json({ error: e?.message ?? "webhook handler error" }, { status: 500 });
  }
}
