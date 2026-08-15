import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { getSupabaseServerEnv } from "@/lib/server/env";

async function sendLoginCode(email: string) {
  const { url, anonKey } = getSupabaseServerEnv();
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return NextResponse.json({ eligible: true, sent: true });
}

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
    if (member) return sendLoginCode(email);

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
        if (profile?.is_admin) return sendLoginCode(email);
        return NextResponse.json({ eligible: false });
      }
      if (!listed.data.nextPage) break;
      page = listed.data.nextPage;
    }

    return NextResponse.json({ eligible: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const rateLimited = /rate|seconds|security purposes/i.test(message);
    return NextResponse.json({ error: rateLimited ? "確認コードは少し時間を空けてから再送してください。" : "確認コードを送信できませんでした。" }, { status: rateLimited ? 429 : 500 });
  }
}
