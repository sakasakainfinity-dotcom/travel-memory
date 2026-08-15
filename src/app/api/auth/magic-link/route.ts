import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const email = String((await request.json()).email ?? "").trim().toLowerCase();
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("member_accounts").select("user_id").eq("email", email).eq("status", "active").maybeSingle();
    return NextResponse.json({ eligible: Boolean(data) });
  } catch {
    return NextResponse.json({ error: "ログインを確認できませんでした。" }, { status: 500 });
  }
}
