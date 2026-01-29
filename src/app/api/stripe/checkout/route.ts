
// src/app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ error: "postId がないよ" }, { status: 400 });
    }

    // ★ 環境変数（ここで読む：トップレベルで読まない）
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "STRIPE_SECRET_KEY がVercelに無い" }, { status: 500 });
    }
    if (!SUPABASE_URL) {
      return NextResponse.json({ error: "SUPABASE_URL（またはNEXT_PUBLIC_SUPABASE_URL）が無い" }, { status: 500 });
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY がVercelに無い" }, { status: 500 });
    }

    // ★ クライアント生成（ここで）
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 例：postId が存在するか確認（placesテーブル想定）
    const { data: post, error: e1 } = await supabaseAdmin
      .from("places")
      .select("id, title")
      .eq("id", postId)
      .maybeSingle();

    if (e1) throw e1;
    if (!post) {
      return NextResponse.json({ error: "投稿が見つからん（postId違うかも）" }, { status: 404 });
    }

    // ★ 100円（JPY）決済：origin から戻りURL作る
    const origin = req.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "jpy",
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "高画質保存（システム利用料）" },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      // ここで postId を紐づけ（Webhook/成功画面で使える）
      metadata: { postId },

      success_url: `${origin}/public?paid=1&postId=${encodeURIComponent(postId)}&session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `${origin}/public?paid=0`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "checkout error" }, { status: 500 });
  }
}
