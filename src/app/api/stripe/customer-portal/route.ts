import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const supabaseAdmin = createClient(
  must("NEXT_PUBLIC_SUPABASE_URL"),
  must("SUPABASE_SERVICE_ROLE_KEY")
);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = body?.uid as string | undefined;

    if (!uid) {
      return NextResponse.json({ error: "uid required" }, { status: 400 });
    }

    const { data: prof, error } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", uid)
      .single();

    if (error) {
      return NextResponse.json(
        { error: `profiles fetch: ${error.message}` },
        { status: 500 }
      );
    }

    const customer = (prof as any)?.stripe_customer_id;

    if (!customer) {
      return NextResponse.json(
        { error: "stripe_customer_id がprofilesに無い（Webhookで保存必要）" },
        { status: 400 }
      );
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://your-domain.com";

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/plans`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error("customer-portal error:", e);
    return NextResponse.json(
      { error: e?.message ?? "portal error" },
      { status: 500 }
    );
  }
}
