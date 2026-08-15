import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: status === 500 ? "会員処理に失敗しました。" : message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request);
    const { data, error } = await admin.from("member_accounts").select("user_id,email,status,admin_note,created_at,last_login_at,user_entitlements(id,entitlement_type,valid_from,valid_until,active)").order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ members: data });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request);
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "有効なメールアドレスを入力してください。" }, { status: 400 });
    const existing = await admin.from("member_accounts").select("user_id").eq("email", email).maybeSingle();
    if (existing.data) return NextResponse.json({ userId: existing.data.user_id, existing: true });
    // Reuse an existing PhotoMapper auth identity rather than creating a second account.
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw listed.error;
    const existingAuthUser = listed.data.users.find((user) => user.email?.toLowerCase() === email);
    const created = existingAuthUser ? null : await admin.auth.admin.createUser({ email, email_confirm: true });
    const user = existingAuthUser ?? created?.data.user;
    if (created?.error || !user) throw created?.error ?? new Error("USER_CREATE_FAILED");
    const result = await admin.from("member_accounts").insert({ user_id: user.id, email, admin_note: String(body.adminNote ?? "").trim() || null });
    if (result.error) { if (!existingAuthUser) await admin.auth.admin.deleteUser(user.id); throw result.error; }
    return NextResponse.json({ userId: user.id, existing: Boolean(existingAuthUser) }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, actorId } = await requireAdmin(request);
    const body = await request.json();
    const userId = String(body.userId ?? "");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (body.status) {
      const { error } = await admin.from("member_accounts").update({ status: body.status, admin_note: body.adminNote ?? null }).eq("user_id", userId);
      if (error) throw error;
    }
    if (body.entitlement) {
      const e = body.entitlement;
      if (!["if_then_bingo", "stay_coupon"].includes(e.type)) return NextResponse.json({ error: "Invalid entitlement" }, { status: 400 });
      let stayId: string | null = null;
      if (e.type === "stay_coupon" && e.active) {
        if (!e.validFrom || !e.validUntil || Date.parse(e.validUntil) <= Date.parse(e.validFrom)) return NextResponse.json({ error: "宿泊期間を正しく入力してください。" }, { status: 400 });
        const stay = await admin.from("stays").insert({ user_id: userId, check_in_at: e.validFrom, check_out_at: e.validUntil, reservation_source: "official" }).select("id").single();
        if (stay.error) throw stay.error;
        stayId = stay.data.id;
      }
      const { error } = await admin.from("user_entitlements").upsert({ user_id: userId, entitlement_type: e.type, active: Boolean(e.active), valid_from: e.validFrom || null, valid_until: e.validUntil || null, created_by: actorId, stay_id: stayId }, { onConflict: "user_id,entitlement_type" });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
