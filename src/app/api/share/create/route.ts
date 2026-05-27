import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";

function token64() {
  return crypto.randomBytes(32).toString("hex"); // 64文字
}

export async function POST(req: Request) {
  try {
    const { space_id } = await req.json();
    if (!space_id) return NextResponse.json({ error: "space_id required" }, { status: 400 });

    const supabaseAdmin = getSupabaseAdmin();
    const share_token = token64();

    const { error } = await supabaseAdmin.from("space_shares").upsert(
      {
        space_id,
        share_token,
        enabled: true,
        include_private: false,
      },
      { onConflict: "space_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ share_token });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "create error" }, { status: 500 });
  }
}
