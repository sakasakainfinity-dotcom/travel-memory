// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

// ✅ EdgeだとStripeの署名検証で詰むことあるので nodejs 固定
export const runtime = "nodejs";
// ✅ 静的最適化されると変なタイミングで評価されがちなので強制ダイナミック
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

// 署名検証は “生” のbody必須
async function getRawBody(req: Request) {
  const ab = await req.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: Request) {
  let stripe: Stripe;

  try {
    // ✅ ここで初めて読む（モジュール直下で読まない）
    const secretKey = mustEnv("STRIPE_SECRET_KEY");
    stripe = new Stripe(secretKey); // apiVersionは指定しない（型でコケた件の保険）
  } catch (e: any) {
    console.error("[webhook] init error:", e?.message ?? e);
    return NextResponse.json({ error: "Stripe env missing" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const webhookSecret = mustEnv("STRIPE_WEBHOOK_SECRET");
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (e: any) {
    console.error("[webhook] signature verify failed:", e?.message ?? e);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ✅ まずはこれだけで十分（Checkout完了）
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // paid以外（無料/未払い/非同期）を弾く
        // ただし支払い方法によっては completed時点でpaidにならないケースもあるので
        // 必要なら checkout.session.async_payment_succeeded も見る（下に入れてる）
        if (session.payment_status !== "paid") {
          console.log("[webhook] checkout completed but not paid yet:", session.id, session.payment_status);
          return NextResponse.json({ received: true });
        }

        // ✅ フロントからmetadataで渡す想定：postId / userId
        const postId = session.metadata?.postId ?? null;
        const userId = session.metadata?.userId ?? session.metadata?.uid ?? null;

        if (!postId || !userId) {
          console.warn("[webhook] missing metadata postId/userId. session:", session.id);
          return NextResponse.json({ received: true });
        }

        // ✅ ここからSupabase（必要時だけ）
        try {
          const { createClient } = await import("@supabase/supabase-js");

          const supabaseUrl = mustEnv("SUPABASE_URL");
          const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");

          const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
          });

          // 例：購入権利テーブル（あなたのDB名に合わせて変えて）
          // 推奨ユニーク： (post_id, user_id)
          const { error } = await supabaseAdmin
            .from("post_purchases")
            .upsert(
              {
                post_id: postId,
                user_id: userId,
                stripe_session_id: session.id,
                amount: session.amount_total ?? 100,
                currency: session.currency ?? "jpy",
              },
              { onConflict: "post_id,user_id" }
            );

          if (error) {
            console.error("[webhook] supabase upsert error:", error);
            // Stripeはリトライする可能性あるけど、ここで500返すと無限リトライになりがち
            // ただ、DB反映が必須なら 500返してリトライさせるのもアリ。
            // 今回は「落ちにくさ」優先で200返す。
          }
        } catch (e: any) {
          console.error("[webhook] supabase error:", e?.message ?? e);
        }

        return NextResponse.json({ received: true });
      }

      // ✅ “後で支払い確定” のタイプも一応対応しとく（コンビニ/銀行系など）
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[webhook] async payment succeeded:", session.id);
        // 必要なら上と同じ処理をここにもコピペでOK（共通関数にしてもよい）
        return NextResponse.json({ received: true });
      }

      // それ以外は全部OK返し（Stripeは「受け取った？」だけ見とる）
      default: {
        console.log("[webhook] unhandled event:", event.type);
        return NextResponse.json({ received: true });
      }
    }
  } catch (e: any) {
    console.error("[webhook] handler error:", e?.message ?? e);
    // ✅ ここで500返すとStripeがリトライする（復旧したら勝手に再処理される）
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
