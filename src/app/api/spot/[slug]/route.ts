import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const slug = (params.slug ?? "").trim();
    if (!slug) return NextResponse.json({ error: "missing slug" }, { status: 400 });

    const { data: c, error: cErr } = await supabaseAdmin
      .from("spot_collections")
      .select("id, title, description, share_slug")
      .eq("share_slug", slug)
      .eq("is_public", true)
      .single();

    if (cErr || !c) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { data: items, error: iErr } = await supabaseAdmin
      .from("spot_collection_items")
      .select("place_id, sort_order")
      .eq("collection_id", c.id)
      .order("sort_order", { ascending: true });
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    const placeIds = (items ?? []).map((x: any) => x.place_id);
    const { data: places, error: pErr } = placeIds.length
      ? await supabaseAdmin
          .from("places")
          .select("id, title, memo, lat, lng, visibility, created_by_name")
          .in("id", placeIds)
          .eq("visibility", "public")
      : { data: [], error: null as any };

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const { data: photos, error: phErr } = placeIds.length
      ? await supabaseAdmin.from("photos").select("place_id, file_url, created_at").in("place_id", placeIds).order("created_at", { ascending: true })
      : { data: [], error: null as any };

    if (phErr) return NextResponse.json({ error: phErr.message }, { status: 500 });

    const photoBy: Record<string, string[]> = {};
    for (const ph of (photos ?? []) as { place_id: string; file_url: string }[]) {
      (photoBy[ph.place_id] ||= []).push(ph.file_url);
    }

    const placeById: Record<string, any> = {};
    for (const p of places ?? []) placeById[(p as any).id] = p;

    const orderedPlaces = (items ?? [])
      .map((it: any) => placeById[it.place_id])
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
        name: p.title,
        title: p.title,
        memo: p.memo,
        lat: p.lat,
        lng: p.lng,
        visibility: "public" as const,
        photos: photoBy[p.id] ?? [],
      }));

    const creatorName = orderedPlaces.length > 0 ? (placeById[orderedPlaces[0].id]?.created_by_name ?? "名無しの旅人") : "名無しの旅人";

    return NextResponse.json({
      collection: {
        title: c.title,
        description: c.description,
        share_slug: c.share_slug,
        creatorName,
      },
      places: orderedPlaces,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "unexpected error" }, { status: 500 });
  }
}
