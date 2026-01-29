import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { sessionId, placeId } = await req.json();
    if (!sessionId || !placeId) return new Response("missing params", { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return new Response("not paid", { status: 402 });

    const { data, error } = await supabase
      .from("photos")
      .select("file_url, url, thumb_url")
      .eq("place_id", placeId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return new Response(`db error: ${error.message}`, { status: 500 });

    const row = data?.[0];
    const downloadUrl = row?.file_url ?? row?.url ?? row?.thumb_url;
    if (!downloadUrl) return new Response("no photo url", { status: 404 });

    return Response.json({ downloadUrl });
  } catch (e: any) {
    return new Response(e?.message || "server error", { status: 500 });
  }
}


function normalizeToStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  // json文字列で入ってる場合
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
      // 文字列単体URLの可能性
      if (typeof parsed === "string") return [parsed];
      // URL文字列そのものの場合
      if (v.startsWith("http")) return [v];
    } catch {
      if (v.startsWith("http")) return [v];
    }
  }
  return [];
}
