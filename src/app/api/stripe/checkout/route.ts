import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { postId } = await req.json();

    // ✅ ログイン必須：AuthorizationのJWTで本人確認
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "No auth token" }, { status: 401 });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    const uid = userRes.user.id;

    // すでに購入済みならCheckout作らずOK（任意）
    const { data: already } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("user_id", uid)
      .eq("post_id", postId)
      .maybeSingle();

    if (already) {
      return NextResponse.json({ alreadyPaid: true });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: { name: "高画質写真の保存（投稿まるごと）" },
            unit_amount: 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/public?paid=1&post=${encodeURIComponent(postId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/public?paid=0&post=${encodeURIComponent(postId)}`,
      metadata: { post_id: String(postId), user_id: String(uid) },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "checkout error" }, { status: 500 });
  }
}
