import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/adminAuth";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request);
    const storeId = request.nextUrl.searchParams.get("storeId");
    const [stores, usages] = await Promise.all([
      admin.from("coupon_stores").select("store_id,store_name").eq("active", true).order("store_name"),
      admin.from("coupon_usages").select("id,store_id,user_id,reservation_id,used_at,coupons(title),coupon_stores(store_name)").order("used_at", { ascending: false }).limit(200).match(storeId ? { store_id: storeId } : {}),
    ]);
    if (stores.error || usages.error) throw stores.error ?? usages.error;
    const now = new Date(), today = new Date(now); today.setHours(0, 0, 0, 0); const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = usages.data ?? [];
    const summary = await Promise.all((stores.data ?? []).map(async store => {
      const base = () => admin.from("coupon_usages").select("id", { count: "exact", head: true }).eq("store_id", store.store_id);
      const [day, monthly, total] = await Promise.all([base().gte("used_at", today.toISOString()), base().gte("used_at", month.toISOString()), base()]);
      const countError = day.error ?? monthly.error ?? total.error; if (countError) throw countError;
      return { ...store, today: day.count ?? 0, month: monthly.count ?? 0, total: total.count ?? 0 };
    }));
    return NextResponse.json({ summary, usages: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: "利用実績を取得できませんでした。" }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
  }
}
