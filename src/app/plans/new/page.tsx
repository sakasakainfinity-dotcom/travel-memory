"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { TripPlanAIResult, TripPlanDraft, TripPlanInput } from "@/lib/tripPlanTypes";

const REL_OPTIONS = ["夫婦", "カップル", "友達", "家族", "子連れ", "その他"];
const BUDGET_OPTIONS = ["節約", "ふつう", "ちょっと贅沢", "贅沢"];

export default function PlanNewPage() {
  const router = useRouter();

  const [form, setForm] = useState<TripPlanInput>({ tripLengthType: "day_trip", visibility: "private" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState<TripPlanAIResult | null>(null);
  const [aiMeta, setAiMeta] = useState<{ provider: string; model: string } | null>(null);

  const canGenerate = useMemo(() => !!form.destination1 && !!form.departureFrom, [form.destination1, form.departureFrom]);

  const onGenerate = async () => {
    if (!canGenerate) {
      alert("出発地と目的地1は入力してください");
      return;
    }
    setLoading(true);
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

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "14px 12px 80px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 22 }}>旅のしおり作成</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>AIで2案を生成して選ぶか、手動で作成できます。</p>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <label>しおりタイトル（手動作成時）<input value={title} onChange={(e) => setTitle(e.target.value)} style={input} /></label>
        <label>説明（手動作成時）<textarea value={description} onChange={(e) => setDescription(e.target.value)} style={input} /></label>
        <label>出発地<input value={form.departureFrom ?? ""} onChange={(e) => setForm({ ...form, departureFrom: e.target.value })} style={input} /></label>
        <label>人数<input type="number" value={form.peopleCount ?? ""} onChange={(e) => setForm({ ...form, peopleCount: Number(e.target.value) || undefined })} style={input} /></label>
        <label>関係性
          <select value={form.relationship ?? ""} onChange={(e) => setForm({ ...form, relationship: e.target.value || undefined })} style={input}>
            <option value="">選択</option>
            {REL_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>日程
          <select value={form.tripLengthType} onChange={(e) => setForm({ ...form, tripLengthType: e.target.value as any })} style={input}>
            <option value="day_trip">日帰り</option>
            <option value="overnight">宿泊</option>
          </select>
        </label>
        {form.tripLengthType === "overnight" && (
          <label>泊数<input type="number" value={form.nights ?? 1} onChange={(e) => setForm({ ...form, nights: Number(e.target.value) || 1 })} style={input} /></label>
        )}
        <label>目的地1<input value={form.destination1 ?? ""} onChange={(e) => setForm({ ...form, destination1: e.target.value })} style={input} /></label>
        <label>目的地2（任意）<input value={form.destination2 ?? ""} onChange={(e) => setForm({ ...form, destination2: e.target.value })} style={input} /></label>
        <label>絶対にしたいこと<textarea value={form.mustDo ?? ""} onChange={(e) => setForm({ ...form, mustDo: e.target.value })} style={input} /></label>
        <label>朝ごはんの希望<input value={form.breakfastNote ?? ""} onChange={(e) => setForm({ ...form, breakfastNote: e.target.value })} style={input} /></label>
        <label>お昼ご飯の希望<input value={form.lunchNote ?? ""} onChange={(e) => setForm({ ...form, lunchNote: e.target.value })} style={input} /></label>
        <label>夕食の希望<input value={form.dinnerNote ?? ""} onChange={(e) => setForm({ ...form, dinnerNote: e.target.value })} style={input} /></label>
        <label>予算感
          <select value={form.budgetLevel ?? ""} onChange={(e) => setForm({ ...form, budgetLevel: e.target.value || undefined })} style={input}>
            <option value="">選択</option>
            {BUDGET_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>公開範囲
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as any })} style={input}>
            <option value="private">private</option>
            <option value="pair">pair</option>
            <option value="public">public</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <button onClick={() => void onGenerate()} disabled={loading} style={btn}>AIでおすすめしおりを作成</button>
        <button onClick={() => void saveManual()} disabled={loading} style={btn}>手動で保存</button>
      </div>

      {aiMeta && <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>AI provider: {aiMeta.provider} / model: {aiMeta.model}</p>}

      {ai?.plans?.length ? (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900 }}>AI生成の2案</h2>
            <button onClick={() => void onGenerate()} style={mini}>再生成</button>
          </div>
          <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "85%", overflowX: "auto", gap: 10 }}>
            {ai.plans.map((plan, idx) => (
              <article key={idx} style={{ border: "1px solid #cbd5e1", borderRadius: 14, padding: 12, background: "#fff" }}>
                <h3 style={{ margin: 0, fontWeight: 900 }}>{plan.title}</h3>
                <p style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>{plan.concept}</p>
                <p style={{ fontSize: 12, marginTop: 6 }}>予算: {plan.estimatedCostMin ?? "-"} 〜 {plan.estimatedCostMax ?? "-"}円</p>
                <p style={{ fontSize: 12 }}>日程概要: {plan.days.map((d) => `Day${d.dayNumber}:${d.items.length}件`).join(" / ")}</p>
                <ul style={{ fontSize: 12, color: "#334155" }}>
                  {plan.days.flatMap((d) => d.items).slice(0, 4).map((it, i) => (
                    <li key={i}>{it.category ?? "spot"}: {it.title} {it.candidateOptions?.length ? `(候補${it.candidateOptions.length})` : ""}</li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => void saveFromAiDraft(plan)} style={mini}>この案を使う</button>
                  <button onClick={() => void saveManual()} style={mini}>手動で調整する</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

const input: React.CSSProperties = { display: "block", width: "100%", marginTop: 4, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" };
const btn: React.CSSProperties = { border: "none", borderRadius: 10, padding: "12px 10px", fontWeight: 900, background: "#0f172a", color: "white" };
const mini: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 999, padding: "6px 10px", background: "#fff", fontWeight: 700, fontSize: 12 };
