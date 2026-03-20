import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripeEnv } from "@/lib/server/env";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getStripeServer } from "@/lib/server/stripe";

export const runtime = "nodejs";

function getUidFromAny(obj: any): string {
  return String(obj?.metadata?.uid ?? obj?.client_reference_id ?? "").trim();
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const stripe = getStripeServer();
  const supabaseAdmin = getSupabaseAdmin();
  const { webhookSecret } = getStripeEnv();
  if (!webhookSecret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    console.log("✅ stripe event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const uid = getUidFromAny(session);
      if (!uid) return NextResponse.json({ error: "missing uid" }, { status: 400 });

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

      console.log("✅ premium updated for uid:", uid, "customer:", customerId, "sub:", subId);
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const uid = getUidFromAny(sub);

      if (uid) {
        const status = sub.status;
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
