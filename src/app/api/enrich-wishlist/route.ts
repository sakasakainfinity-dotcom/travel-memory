import { NextResponse } from "next/server";
import { enrichWishlist } from "@/lib/ai/wishlistEnrichment";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { placeId, lat, lng, title, memo, address } = body ?? {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
    }

    const enriched = await enrichWishlist({ lat, lng, title, memo, address });

    if (placeId) {
      const admin = getSupabaseAdmin();
      const { error } = await admin
        .from("places")
        .update({
          ai_summary: enriched.ai_summary || null,
          ai_tips: enriched.ai_tips || null,
          ai_generated_at: new Date().toISOString(),
        })
        .eq("id", placeId);
      if (error) throw error;
    }

    return NextResponse.json(enriched);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}
