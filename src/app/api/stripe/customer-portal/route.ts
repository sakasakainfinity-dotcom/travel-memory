import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getAppUrlEnv } from "@/lib/server/env";
import { getStripeServer } from "@/lib/server/stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = body?.uid as string | undefined;

    if (!uid) {
      return NextResponse.json({ error: "uid required" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const stripe = getStripeServer();
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

    const { appUrl, baseUrl, siteUrl } = getAppUrlEnv();
    const origin = req.headers.get("origin") || appUrl || baseUrl || siteUrl || "https://your-domain.com";

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${origin}/list`,
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
