import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const token = (params.token ?? "").trim();
    if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

    const { data: share, error: sErr } = await supabaseAdmin
      .from("space_shares")
      .select("space_id, enabled, include_private")
      .eq("share_token", token)
      .single();

    if (sErr || !share) return NextResponse.json({ error: "invalid token" }, { status: 404 });
    if (!share.enabled) return NextResponse.json({ error: "share disabled" }, { status: 403 });

    // 今は public のみ
    const vis = share.include_private ? ["public", "private", "pair"] : ["public"];

    const { data: ps, error: pErr } = await supabaseAdmin
      .from("places")
      .select("id, title, memo, lat, lng, visibility, created_at")
      .eq("space_id", share.space_id)
      .in("visibility", vis)
      .order("created_at", { ascending: false })
      .limit(500);

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const placeIds = (ps ?? []).map((p: any) => p.id);

    // photos を place_id でまとめる
    let photosBy: Record<string, string[]> = {};
    if (placeIds.length > 0) {
      const { data: phs, error: ePh } = await supabaseAdmin
        .from("photos")
        .select("place_id, file_url")
        .in("place_id", placeIds);

      if (ePh) return NextResponse.json({ error: ePh.message }, { status: 500 });

      for (const ph of phs ?? []) {
        const pid = (ph as any).place_id as string;
        const url = (ph as any).file_url as string;
        (photosBy[pid] ||= []).push(url);
      }
    }

    const places = (ps ?? []).map((p: any) => ({
      id: p.id,
      name: p.title,          // MapViewは name を使うことが多いので合わせる
      memo: p.memo ?? null,
      lat: p.lat,
      lng: p.lng,
      visibility: p.visibility,
      created_at: p.created_at,
      photos: photosBy[p.id] ?? [],
    }));

    return NextResponse.json({ places });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "share error" }, { status: 500 });
  }
}
