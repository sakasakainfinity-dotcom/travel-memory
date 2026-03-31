"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";

type PlanRow = {
  id: string;
  title: string;
  trip_length_type: "day_trip" | "overnight";
  nights: number | null;
  destination_1: string | null;
  destination_2: string | null;
  visibility: "public" | "private";
  estimated_cost_min: number | null;
  estimated_cost_max: number | null;
  cover_photo_url: string | null;
  share_token: string | null;
  created_at: string;
};

export default function PlansPage() {
  const router = useRouter();
  const [privatePlans, setPrivatePlans] = useState<PlanRow[]>([]);
  const [publicPlans, setPublicPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: ses } = await supabase.auth.getSession();
    if (!ses.session?.user?.id) {
      router.push("/login");
      return;
    }
    const space = await ensureMySpace();
    if (!space?.id) {
      setPrivatePlans([]);
      setPublicPlans([]);
      setLoading(false);
      return;
    }

    const [privateRes, publicRes] = await Promise.all([
      supabase
      .from("trip_plans")
      .select("id,title,trip_length_type,nights,destination_1,destination_2,visibility,estimated_cost_min,estimated_cost_max,cover_photo_url,share_token,created_at")
      .eq("space_id", space.id)
      .eq("visibility", "private")
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
      supabase
      .from("trip_plans")
      .select("id,title,trip_length_type,nights,destination_1,destination_2,visibility,estimated_cost_min,estimated_cost_max,cover_photo_url,share_token,created_at")
      .eq("space_id", space.id)
      .eq("visibility", "public")
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    ]);

    setPrivatePlans((privateRes.data ?? []) as PlanRow[]);
    setPublicPlans((publicRes.data ?? []) as PlanRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  async function removePlan(id: string) {
    if (!confirm("このしおりを削除しますか？")) return;
    await supabase.from("trip_plans").delete().eq("id", id);
    await load();
  }

  return (
    <main style={{ padding: "16px 12px 96px", maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>旅のしおり</h1>
      <p style={{ color: "#475569", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        旅行前にしおりを作る / AIに2案考えてもらう / 旅行後に写真を追加して思い出として残せます。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push("/plans/new?mode=ai")} style={ctaStyle("#7c3aed")}>2案の旅しおりを作る</button>
        <button onClick={() => router.push("/plans/new?mode=manual")} style={ctaStyle("#2563eb")}>手動でしおりを作る</button>
      </div>

      {loading && <div>読み込み中...</div>}

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 900 }}>private</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {privatePlans.map((plan) => (
          <article key={plan.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            {plan.cover_photo_url ? (
              <img src={plan.cover_photo_url} alt="表紙" style={{ width: "100%", height: 140, objectFit: "cover" }} />
            ) : null}
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 900 }}>{plan.title}</div>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
                {plan.trip_length_type === "day_trip" ? "日帰り" : `${plan.nights ?? 1}泊`} / {plan.destination_1 ?? "目的地未設定"}
                {plan.destination_2 ? `・${plan.destination_2}` : ""}
              </div>
              <div style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>
                公開範囲: {plan.visibility} / 予算: {plan.estimated_cost_min ?? "-"}〜{plan.estimated_cost_max ?? "-"}円
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <Link href={`/plans/${plan.id}`} style={miniBtn}>開く</Link>
                <button onClick={() => router.push(`/plans/new?edit=${plan.id}&mode=manual`)} style={miniBtn}>編集</button>
                <button onClick={() => void removePlan(plan.id)} style={miniBtn}>削除</button>
                {plan.visibility === "public" && plan.share_token ? (
                  <Link href={`/share/plan/${plan.share_token}`} style={miniBtn}>しおりを共有</Link>
                ) : null}
              </div>
            </div>
          </article>
          ))}
          {!loading && privatePlans.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>private のしおりはまだありません。</div> : null}
        </div>
      </section>

      <section>
        <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 900 }}>public</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {publicPlans.map((plan) => (
            <article key={plan.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
              {plan.cover_photo_url ? (
                <img src={plan.cover_photo_url} alt="表紙" style={{ width: "100%", height: 140, objectFit: "cover" }} />
              ) : null}
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>{plan.title}</div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
                  {plan.trip_length_type === "day_trip" ? "日帰り" : `${plan.nights ?? 1}泊`} / {plan.destination_1 ?? "目的地未設定"}
                  {plan.destination_2 ? `・${plan.destination_2}` : ""}
                </div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>
                  公開範囲: {plan.visibility} / 予算: {plan.estimated_cost_min ?? "-"}〜{plan.estimated_cost_max ?? "-"}円
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Link href={`/plans/${plan.id}`} style={miniBtn}>開く</Link>
                  <button onClick={() => router.push(`/plans/new?edit=${plan.id}&mode=manual`)} style={miniBtn}>編集</button>
                  <button onClick={() => void removePlan(plan.id)} style={miniBtn}>削除</button>
                  {plan.share_token ? (
                    <Link href={`/share/plan/${plan.share_token}`} style={miniBtn}>しおりを共有</Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!loading && publicPlans.length === 0 ? <div style={{ color: "#64748b", fontSize: 13 }}>public のしおりはまだありません。</div> : null}
        </div>
      </section>
    </main>
  );
}

function ctaStyle(color: string): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 12,
    padding: "12px 10px",
    color: "white",
    fontWeight: 900,
    background: `linear-gradient(135deg, ${color}, #0ea5e9)`,
  };
}

const miniBtn: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "6px 10px",
  background: "#fff",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 700,
};
