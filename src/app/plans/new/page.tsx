"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { TripPlanAIResult, TripPlanDraft, TripPlanInput } from "@/lib/tripPlanTypes";

const REL_OPTIONS = ["1人", "夫婦", "カップル", "友達", "家族", "子連れ", "その他"];
const BUDGET_OPTIONS = ["節約", "ふつう", "ちょっと贅沢", "贅沢"];
const STEP_LOADING_TEXTS = [
  "旅のしおりを作成中です…",
  "地元らしい候補を探しています…",
  "朝食・ランチ・夕食・宿泊候補をまとめています…",
  "いい感じの2案に整えています…",
];

export default function PlanNewPage() {
  const router = useRouter();

  const [form, setForm] = useState<TripPlanInput>({ tripLengthType: "day_trip", visibility: "private" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<TripPlanAIResult | null>(null);
  const [detailPlan, setDetailPlan] = useState<TripPlanDraft | null>(null);
  const [aiMeta, setAiMeta] = useState<{ provider: string; model: string } | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STEP_LOADING_TEXTS.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [loading]);

  const canGenerate = useMemo(() => !!form.destination1 && !!form.departureFrom, [form.destination1, form.departureFrom]);

  const onGenerate = async () => {
    if (!canGenerate) {
      alert("出発地と目的地1は入力してください");
      return;
    }
    setLoading(true);
    setMessageIndex(0);
    const res = await fetch("/api/plans/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error ?? "AI生成に失敗しました");
      setLoading(false);
      return;
    }
    setAi(json.result);
    setAiMeta({ provider: json.provider, model: json.model });

    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id;
    if (uid) {
      await supabase.from("ai_plan_generations").insert({
        created_by: uid,
        input_payload: form,
        output_payload: json.result,
        provider: json.provider,
        model: json.model,
      });
    }
    setLoading(false);
  };

  const saveManual = async () => {
    setLoading(true);
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) {
      router.push("/login");
      return;
    }
    const space = await ensureMySpace();
    if (!space?.id) return;

    const shareToken = form.visibility === "public" ? crypto.randomUUID().replaceAll("-", "") : null;
    const { data: row, error } = await supabase
      .from("trip_plans")
      .insert({
        space_id: space.id,
        created_by: uid,
        title: title || `${form.destination1 ?? "旅"}のしおり`,
        description,
        departure_from: form.departureFrom,
        people_count: form.peopleCount,
        relationship: form.relationship,
        trip_length_type: form.tripLengthType,
        nights: form.nights,
        destination_1: form.destination1,
        destination_2: form.destination2,
        must_do: form.mustDo,
        breakfast_note: form.breakfastNote,
        lunch_note: form.lunchNote,
        dinner_note: form.dinnerNote,
        budget_level: form.budgetLevel,
        visibility: form.visibility,
        share_token: shareToken,
      })
      .select("id")
      .single();

    setLoading(false);
    if (error || !row?.id) {
      alert(error?.message ?? "保存に失敗しました");
      return;
    }
    router.push(`/plans/${row.id}`);
  };

  const saveFromAiDraft = async (draft: TripPlanDraft) => {
    setLoading(true);
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user?.id;
    if (!uid) {
      router.push("/login");
      return;
    }
    const space = await ensureMySpace();
    if (!space?.id) return;

    const shareToken = form.visibility === "public" ? crypto.randomUUID().replaceAll("-", "") : null;
    const { data: inserted, error } = await supabase
      .from("trip_plans")
      .insert({
        space_id: space.id,
        created_by: uid,
        title: draft.title,
        description: draft.concept,
        departure_from: form.departureFrom,
        people_count: form.peopleCount,
        relationship: form.relationship,
        trip_length_type: form.tripLengthType,
        nights: form.nights,
        destination_1: form.destination1,
        destination_2: form.destination2,
        must_do: form.mustDo,
        breakfast_note: form.breakfastNote,
        lunch_note: form.lunchNote,
        dinner_note: form.dinnerNote,
        budget_level: form.budgetLevel,
        estimated_cost_min: draft.estimatedCostMin,
        estimated_cost_max: draft.estimatedCostMax,
        visibility: form.visibility,
        share_token: shareToken,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      setLoading(false);
      alert(error?.message ?? "しおり保存に失敗しました");
      return;
    }

    const stops = draft.days.flatMap((d) =>
      d.items.map((item, index) => ({
        plan_id: inserted.id,
        sort_order: index,
        day_number: d.dayNumber,
        start_time: item.startTime,
        end_time: item.endTime,
        category: item.category,
        title: item.title,
        memo: item.memo,
        address: item.address,
        candidate_group_key: item.candidateOptions?.length ? `${d.dayNumber}-${index}` : null,
        candidate_options: item.candidateOptions ?? null,
        estimated_cost_min: item.estimatedCostMin,
        estimated_cost_max: item.estimatedCostMax,
      }))
    );

    if (stops.length) {
      await supabase.from("trip_plan_stops").insert(stops);
    }

    setLoading(false);
    router.push(`/plans/${inserted.id}`);
  };

  const selectionChips = [
    form.destination1 ? `目的地: ${form.destination1}${form.destination2 ? `・${form.destination2}` : ""}` : null,
    form.relationship ? `同行者: ${form.relationship}` : null,
    `日程: ${form.tripLengthType === "day_trip" ? "日帰り" : `${form.nights ?? 1}泊`}`,
    form.budgetLevel ? `予算: ${form.budgetLevel}` : null,
    `公開: ${form.visibility}`,
  ].filter(Boolean) as string[];

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "14px 12px 80px" }}>
      <Link href="/plans" style={backBtn}>旅のしおり一覧へ戻る</Link>
      <h1 style={{ fontWeight: 900, fontSize: 26, marginTop: 12 }}>旅のしおりを作ってみよう</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>条件をひとつずつ選んで、2案の旅しおりを作ります。</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {selectionChips.map((chip) => (
          <span key={chip} style={chipStyle}>{chip}</span>
        ))}
      </div>

      <section style={stepCard}>
        <StepTitle>1. どこへ行く？</StepTitle>
        <input value={form.destination1 ?? ""} onChange={(e) => setForm({ ...form, destination1: e.target.value })} style={input} placeholder="例: 金沢" />
      </section>

      <section style={stepCard}>
        <StepTitle>2. もう一つ目的地ある？（任意）</StepTitle>
        <input value={form.destination2 ?? ""} onChange={(e) => setForm({ ...form, destination2: e.target.value })} style={input} placeholder="例: 能登" />
      </section>

      <section style={stepCard}>
        <StepTitle>3. 誰と過ごす旅？</StepTitle>
        <div style={chipWrap}>
          {REL_OPTIONS.map((v) => (
            <button key={v} style={selectChip(form.relationship === v)} onClick={() => setForm({ ...form, relationship: v })}>{v}</button>
          ))}
        </div>
      </section>

      <section style={stepCard}>
        <StepTitle>4. 日帰り or 宿泊？</StepTitle>
        <div style={chipWrap}>
          <button style={selectChip(form.tripLengthType === "day_trip")} onClick={() => setForm({ ...form, tripLengthType: "day_trip", nights: undefined })}>日帰り</button>
          <button style={selectChip(form.tripLengthType === "overnight")} onClick={() => setForm({ ...form, tripLengthType: "overnight", nights: form.nights ?? 1 })}>宿泊</button>
        </div>
        {form.tripLengthType === "overnight" ? (
          <div style={{ marginTop: 10 }}>
            <StepTitle>5. 宿泊なら何泊？</StepTitle>
            <input type="number" min={1} value={form.nights ?? 1} onChange={(e) => setForm({ ...form, nights: Number(e.target.value) || 1 })} style={input} />
          </div>
        ) : null}
      </section>

      <section style={stepCard}><StepTitle>6. 絶対にしたいこと</StepTitle><textarea value={form.mustDo ?? ""} onChange={(e) => setForm({ ...form, mustDo: e.target.value })} style={input} /></section>
      <section style={stepCard}><StepTitle>7. 朝ごはんの希望</StepTitle><input value={form.breakfastNote ?? ""} onChange={(e) => setForm({ ...form, breakfastNote: e.target.value })} style={input} /></section>
      <section style={stepCard}><StepTitle>8. お昼ごはんの希望</StepTitle><input value={form.lunchNote ?? ""} onChange={(e) => setForm({ ...form, lunchNote: e.target.value })} style={input} /></section>
      <section style={stepCard}><StepTitle>9. 夕食の希望</StepTitle><input value={form.dinnerNote ?? ""} onChange={(e) => setForm({ ...form, dinnerNote: e.target.value })} style={input} /></section>

      <section style={stepCard}>
        <StepTitle>10. 予算はどのくらい？</StepTitle>
        <div style={chipWrap}>
          {BUDGET_OPTIONS.map((v) => <button key={v} style={selectChip(form.budgetLevel === v)} onClick={() => setForm({ ...form, budgetLevel: v })}>{v}</button>)}
        </div>
      </section>

      <section style={stepCard}>
        <StepTitle>11. 公開範囲</StepTitle>
        <div style={chipWrap}>
          <button style={selectChip(form.visibility === "private")} onClick={() => setForm({ ...form, visibility: "private" })}>private</button>
          <button style={selectChip(form.visibility === "public")} onClick={() => setForm({ ...form, visibility: "public" })}>public</button>
        </div>
      </section>

      <section style={stepCard}>
        <StepTitle>最後に手動タイトル（任意）</StepTitle>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="手動保存時に使います" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...input, marginTop: 8 }} placeholder="説明（手動保存時）" />
      </section>

      <section style={stepCard}>
        <StepTitle>選択内容のまとめ</StepTitle>
        <ul style={{ margin: 0, paddingLeft: 20, color: "#334155", fontSize: 13, lineHeight: 1.8 }}>
          <li>出発地: {form.departureFrom ?? "未入力"}</li>
          <li>目的地: {form.destination1 ?? "未入力"}{form.destination2 ? ` / ${form.destination2}` : ""}</li>
          <li>同行者: {form.relationship ?? "未選択"}</li>
          <li>日程: {form.tripLengthType === "day_trip" ? "日帰り" : `${form.nights ?? 1}泊`}</li>
          <li>予算感: {form.budgetLevel ?? "未選択"}</li>
        </ul>
      </section>

      <section style={stepCard}>
        <StepTitle>出発地</StepTitle>
        <input value={form.departureFrom ?? ""} onChange={(e) => setForm({ ...form, departureFrom: e.target.value })} style={input} placeholder="例: 東京" />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <button onClick={() => void onGenerate()} disabled={loading} style={btn}>AIにしおりを考えてもらう</button>
        <button onClick={() => void saveManual()} disabled={loading} style={subBtn}>手動で保存</button>
      </div>

      {aiMeta && <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>AI provider: {aiMeta.provider} / model: {aiMeta.model}</p>}

      {loading ? (
        <div style={loadingOverlay}>
          <div style={loadingCard}>
            <div style={spinner} />
            <div style={{ fontWeight: 800, marginTop: 8 }}>{STEP_LOADING_TEXTS[messageIndex]}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>しおりづくりの進行中です。画面はこのままでOKです。</div>
          </div>
        </div>
      ) : null}

      {ai?.plans?.length ? (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 19, fontWeight: 900 }}>2案の旅しおり</h2>
            <button onClick={() => void onGenerate()} style={mini}>再生成</button>
          </div>
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "90%", overflowX: "auto", gap: 12, paddingBottom: 8 }}>
            {ai.plans.map((plan, idx) => {
              const allItems = plan.days.flatMap((d) => d.items);
              const summary = (category: string) => allItems.find((item) => item.category === category)?.candidateOptions?.[0]?.name ?? "候補を生成中";
              return (
                <article key={idx} style={resultCard}>
                  <p style={{ fontSize: 12, color: "#7c3aed", margin: 0, fontWeight: 800 }}>PLAN {idx + 1}</p>
                  <h3 style={{ margin: "4px 0", fontWeight: 900, fontSize: 18 }}>{plan.title}</h3>
                  <p style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>{plan.concept}</p>
                  <p style={{ fontSize: 12, color: "#334155", marginTop: 4 }}>👤 {plan.recommendedFor ?? "食事と観光をバランス良く楽しみたい人向け"}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <span style={chipStyle}>💰 {plan.estimatedCostMin ?? "-"}〜{plan.estimatedCostMax ?? "-"}円</span>
                    <span style={chipStyle}>🗓 {plan.days.length === 1 ? "日帰り" : `${plan.days.length - 1}泊${plan.days.length}日`}</span>
                  </div>
                  <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12 }}>
                    <div>🍳 朝食: {summary("breakfast")}</div>
                    <div>🍽 ランチ: {summary("lunch")}</div>
                    <div>🌙 夕食: {summary("dinner")}</div>
                    <div>🛏 宿泊: {summary("hotel")}</div>
                    <div>📸 観光: {summary("sightseeing")}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => setDetailPlan(plan)} style={mini}>詳細を見る</button>
                    <button onClick={() => void saveFromAiDraft(plan)} style={miniPrimary}>この案を使う</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {detailPlan ? (
        <div style={loadingOverlay}>
          <div style={{ ...loadingCard, maxWidth: 720, maxHeight: "85vh", overflowY: "auto", textAlign: "left" }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{detailPlan.title}</h3>
            <p style={{ color: "#475569", fontSize: 13 }}>{detailPlan.concept}</p>
            <p style={{ fontSize: 13 }}>予算: {detailPlan.estimatedCostMin ?? "-"}〜{detailPlan.estimatedCostMax ?? "-"}円</p>
            {detailPlan.days.map((day) => (
              <section key={day.dayNumber} style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
                <h4 style={{ margin: 0 }}>Day {day.dayNumber}</h4>
                {day.items.map((item, i) => (
                  <div key={i} style={{ marginTop: 8, borderTop: "1px dashed #e2e8f0", paddingTop: 6 }}>
                    <div style={{ fontWeight: 700 }}>{item.startTime ?? "--:--"} {item.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{item.memo ?? ""}</div>
                    {item.candidateOptions?.length ? (
                      <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12 }}>
                        {item.candidateOptions.slice(0, 3).map((opt, idx) => (
                          <li key={idx}>{opt.name} {opt.feature ? `- ${opt.feature}` : ""} ({opt.costMin ?? "-"}〜{opt.costMax ?? "-"}円)</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </section>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => void saveFromAiDraft(detailPlan)} style={miniPrimary}>この案を使う</button>
              <button onClick={() => void saveManual()} style={mini}>保存して編集へ</button>
              <button onClick={() => setDetailPlan(null)} style={mini}>閉じる</button>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx global>{`
        @keyframes plan-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

function StepTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 900 }}>{children}</h2>;
}

const stepCard: React.CSSProperties = { marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, background: "linear-gradient(180deg,#fff,#f8fafc)" };
const input: React.CSSProperties = { display: "block", width: "100%", marginTop: 4, border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px" };
const btn: React.CSSProperties = { border: "none", borderRadius: 12, padding: "12px 10px", fontWeight: 900, background: "linear-gradient(135deg,#7c3aed,#0ea5e9)", color: "white" };
const subBtn: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 12, padding: "12px 10px", fontWeight: 800, background: "#fff", color: "#0f172a" };
const mini: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", background: "#fff", fontWeight: 700, fontSize: 12 };
const miniPrimary: React.CSSProperties = { ...mini, border: "none", background: "#0f172a", color: "#fff" };
const chipStyle: React.CSSProperties = { display: "inline-block", padding: "6px 10px", background: "#eef2ff", borderRadius: 999, color: "#4338ca", fontSize: 12, fontWeight: 700 };
const backBtn: React.CSSProperties = { display: "inline-block", border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 13 };
const chipWrap: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const selectChip = (active: boolean): React.CSSProperties => ({ border: "1px solid", borderColor: active ? "#7c3aed" : "#cbd5e1", borderRadius: 999, padding: "8px 12px", background: active ? "#ede9fe" : "#fff", color: active ? "#6d28d9" : "#334155", fontWeight: 700, fontSize: 13 });
const resultCard: React.CSSProperties = { border: "1px solid #dbeafe", borderRadius: 16, padding: 14, background: "linear-gradient(150deg,#ffffff,#f8fafc)" };
const loadingOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", display: "grid", placeItems: "center", zIndex: 40, padding: 14 };
const loadingCard: React.CSSProperties = { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, border: "1px solid #cbd5e1", padding: 16, textAlign: "center" };
const spinner: React.CSSProperties = { width: 42, height: 42, border: "4px solid #e2e8f0", borderTopColor: "#7c3aed", borderRadius: "50%", margin: "0 auto", animation: "plan-spin 1s linear infinite" };
