import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const email = String((await request.json()).email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ eligible: false });
    }

    const admin = getSupabaseAdmin();
    const { data: member, error: memberError } = await admin
      .from("member_accounts")
      .select("user_id")
      .eq("email", email)
      .eq("status", "active")
      .maybeSingle();
    if (memberError) throw memberError;
    if (member) return NextResponse.json({ eligible: true });

    // Administrators must be able to obtain a session before they can open the
    // member management screen. They do not need a member entitlement merely
    // to receive a magic link; service access is still checked separately.
    let page = 1;
    while (true) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listed.error) throw listed.error;
      const authUser = listed.data.users.find((user) => user.email?.trim().toLowerCase() === email);
      if (authUser) {
        const { data: profile, error: profileError } = await admin
          .from("profiles")
          .select("is_admin")
          .eq("id", authUser.id)
          .maybeSingle();
        if (profileError) throw profileError;
        return NextResponse.json({ eligible: profile?.is_admin === true });
      }
      if (!listed.data.nextPage) break;
      page = listed.data.nextPage;
    }

    return NextResponse.json({ eligible: false });
  } catch {
    return NextResponse.json({ error: "ログインを確認できませんでした。" }, { status: 500 });
  }
}
