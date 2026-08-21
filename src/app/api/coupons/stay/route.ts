import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

const COUPON_ID = "50000000-0000-4000-8000-000000000001";

async function context(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  return { admin, userId: data.user.id };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const status = message === "UNAUTHORIZED" ? 401 : 500;
  return NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : "クーポン情報の処理に失敗しました。" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { admin, userId } = await context(request);
    const [member, entitlement, coupon, stores] = await Promise.all([
      admin.from("member_accounts").select("status").eq("user_id", userId).maybeSingle(),
      admin.from("user_entitlements").select("active,stay_id,valid_from,valid_until").eq("user_id", userId).eq("entitlement_type", "stay_coupon").maybeSingle(),
      admin.from("coupons").select("coupon_id,title,discount_amount,minimum_spend,valid_from,valid_to,active").eq("coupon_id", COUPON_ID).single(),
      admin.from("coupon_stores").select("store_id,store_name,store_image").eq("active", true).eq("recruiting", false).order("store_name"),
    ]);
    if (coupon.error || stores.error) throw coupon.error ?? stores.error;
    const e = entitlement.data;
    let eligibility: CouponDataEligibility = "denied";
    if (member.data?.status === "active" && e?.active && e.stay_id) {
      const now = Date.now(), from = e.valid_from ? Date.parse(e.valid_from) : 0, until = e.valid_until ? Date.parse(e.valid_until) : Infinity;
      eligibility = now < from ? "before" : now > until ? "expired" : "active";
    }
    let usage = null;
    if (e?.stay_id) {
      const result = await admin.from("coupon_usages").select("id,store_id,discount_amount,used_at,coupon_stores(store_name)").eq("reservation_id", e.stay_id).maybeSingle();
      if (result.error) throw result.error;
      const row = result.data as unknown as { id: string; store_id: string; discount_amount: number; used_at: string; coupon_stores: { store_name: string } | null } | null;
      if (row) usage = { id: row.id, store_id: row.store_id, store_name: row.coupon_stores?.store_name ?? "店舗", discount_amount: row.discount_amount, used_at: row.used_at };
    }
    return NextResponse.json({ coupon: coupon.data, stores: stores.data, usage, eligibility, check_in: e?.valid_from ?? null, check_out: e?.valid_until ?? null });
  } catch (error) { return failure(error); }
}

type CouponDataEligibility = "active" | "before" | "expired" | "denied";

export async function POST(request: NextRequest) {
  try {
    const { admin, userId } = await context(request);
    const storeId = String((await request.json()).storeId ?? "");
    const [member, entitlement, store, coupon] = await Promise.all([
      admin.from("member_accounts").select("status").eq("user_id", userId).maybeSingle(),
      admin.from("user_entitlements").select("active,stay_id,valid_from,valid_until").eq("user_id", userId).eq("entitlement_type", "stay_coupon").maybeSingle(),
      admin.from("coupon_stores").select("store_id").eq("store_id", storeId).eq("active", true).eq("recruiting", false).maybeSingle(),
      admin.from("coupons").select("discount_amount,active,valid_from,valid_to").eq("coupon_id", COUPON_ID).single(),
    ]);
    const e = entitlement.data, now = Date.now();
    if (member.data?.status !== "active" || !e?.active || !e.stay_id) return NextResponse.json({ error: "このクーポンを利用できません。" }, { status: 403 });
    if (!store.data || !coupon.data?.active) return NextResponse.json({ error: "利用できる店舗を選択してください。" }, { status: 400 });
    if ((e.valid_from && now < Date.parse(e.valid_from)) || (e.valid_until && now > Date.parse(e.valid_until))) return NextResponse.json({ error: "現在は滞在期間外です。" }, { status: 409 });
    if ((coupon.data.valid_from && now < Date.parse(coupon.data.valid_from)) || (coupon.data.valid_to && now > Date.parse(coupon.data.valid_to))) return NextResponse.json({ error: "クーポンの有効期間外です。" }, { status: 409 });
    const existing = await admin.from("coupon_usages").select("id").eq("reservation_id", e.stay_id).maybeSingle();
    if (existing.data) return NextResponse.json({ error: "この滞在ではクーポンを利用済みです。" }, { status: 409 });
    const inserted = await admin.from("coupon_usages").insert({ reservation_id: e.stay_id, user_id: userId, coupon_id: COUPON_ID, store_id: storeId, discount_amount: coupon.data.discount_amount }).select("id,used_at").single();
    if (inserted.error) {
      if (inserted.error.code === "23505") return NextResponse.json({ error: "この滞在ではクーポンを利用済みです。" }, { status: 409 });
      throw inserted.error;
    }
    return NextResponse.json({ usage: inserted.data }, { status: 201 });
  } catch (error) { return failure(error); }
}
