import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { clearPartnerSession, createPartnerSession, readPartnerSession, setPartnerSession } from "@/lib/server/couponPartnerSession";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

async function findStore(token: string) {
  const admin = getSupabaseAdmin();
  const result = await admin.from("coupon_stores").select("store_id,store_name").eq("partner_token", token).eq("active", true).maybeSingle();
  if (result.error) throw result.error;
  return { admin, store: result.data };
}

function clientKey(request: NextRequest) {
  const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(source).digest("hex");
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { admin, store } = await findStore(params.token);
    if (!store) return NextResponse.json({ error: "URLまたはPINを確認してください。" }, { status: 404 });
    const key = clientKey(request), since = new Date(Date.now() - WINDOW_MS).toISOString();
    const failures = await admin.from("coupon_partner_pin_attempts").select("id", { count: "exact", head: true }).eq("store_id", store.store_id).eq("client_key_hash", key).eq("succeeded", false).gte("attempted_at", since);
    if (failures.error) throw failures.error;
    if ((failures.count ?? 0) >= MAX_FAILURES) return NextResponse.json({ error: "入力回数が上限に達しました。15分後にお試しください。" }, { status: 429 });
    const body = await request.json();
    const pin = typeof body.pin === "string" ? body.pin : "";
    const verified = pin.length >= 4 && pin.length <= 32 ? await admin.rpc("verify_coupon_store_pin", { target_store_id: store.store_id, candidate_pin: pin }) : { data: false, error: null };
    if (verified.error) throw verified.error;
    await admin.from("coupon_partner_pin_attempts").insert({ store_id: store.store_id, client_key_hash: key, succeeded: verified.data === true });
    if (verified.data !== true) return NextResponse.json({ error: "URLまたはPINを確認してください。" }, { status: 401 });
    const response = NextResponse.json({ authenticated: true, storeName: store.store_name });
    setPartnerSession(response, createPartnerSession(store.store_id));
    return response;
  } catch { return NextResponse.json({ error: "認証処理に失敗しました。" }, { status: 500 }); }
}

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { admin, store } = await findStore(params.token);
    const sessionStoreId = readPartnerSession(request);
    if (!store || sessionStoreId !== store.store_id) return NextResponse.json({ authenticated: false }, { status: 401 });
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const [todayCount, monthCount, totalCount, recent] = await Promise.all([
      admin.from("coupon_usages").select("id", { count: "exact", head: true }).eq("store_id", store.store_id).gte("used_at", today.toISOString()),
      admin.from("coupon_usages").select("id", { count: "exact", head: true }).eq("store_id", store.store_id).gte("used_at", month.toISOString()),
      admin.from("coupon_usages").select("id", { count: "exact", head: true }).eq("store_id", store.store_id),
      admin.from("coupon_usages").select("id,used_at,coupons(title)").eq("store_id", store.store_id).order("used_at", { ascending: false }).limit(30),
    ]);
    const error = todayCount.error ?? monthCount.error ?? totalCount.error ?? recent.error;
    if (error) throw error;
    return NextResponse.json({ storeName: store.store_name, counts: { today: todayCount.count ?? 0, month: monthCount.count ?? 0, total: totalCount.count ?? 0 }, usages: recent.data ?? [] });
  } catch { return NextResponse.json({ error: "利用実績を取得できませんでした。" }, { status: 500 }); }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  clearPartnerSession(response);
  return response;
}
