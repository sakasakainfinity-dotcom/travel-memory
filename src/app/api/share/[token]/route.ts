import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = (params.token ?? "").trim();
    if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

    // 1) token -> space_id
    const { data: share, error: sErr } = await supabaseAdmin
      .from("space_shares")
      .select("space_id, enabled, include_private")
      .eq("share_token", token)
      .single();

    if (sErr || !share) return NextResponse.json({ error: "invalid token" }, { status: 404 });
    if (!share.enabled) return NextResponse.json({ error: "share disabled" }, { status: 403 });

    // 2) space_id -> places（今はpublicだけ）
    // 将来A：include_private=true のとき filter を広げるだけ
    const vis = share.include_private ? ["public", "private", "pair"] : ["public"];

    const { data: places, error: pErr } = await supabaseAdmin
      .from("places")
      .select(
        "id, lat, lng, title, address, memo, created_at, visibility, visited_at, taken_at"
      )
      .eq("space_id", share.space_id)
      .in("visibility", vis)
      .order("created_at", { ascending: false })
      .limit(500);

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    return NextResponse.json({ places: places ?? [] });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "share error" }, { status: 500 });
  }
}
