"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/image";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Plan = any;
type Stop = any;

export default function PlanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data: p } = await supabase.from("trip_plans").select("*").eq("id", id).single();
    const { data: s } = await supabase.from("trip_plan_stops").select("*").eq("plan_id", id).order("day_number").order("sort_order");
    setPlan(p);
    setStops(s ?? []);
  };

  useEffect(() => {
    if (id) void load();
  }, [id]);

  const mapStops = useMemo(
    () =>
      stops
        .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
        .map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, title: `Day${s.day_number} ${s.start_time ?? ""} ${s.title}`, memo: s.memo ?? "", visibility: "public" })),
    [stops]
  );

  const grouped = useMemo(() => {
    const g: Record<number, Stop[]> = {};
    for (const s of stops) (g[s.day_number] ||= []).push(s);
    return g;
  }, [stops]);

  async function uploadStopPhoto(stop: Stop, file: File) {
    if (!plan) return;
    const compressed = await compressImage(file, { maxSide: 1280, quality: 0.72 });
    const ext = compressed.type.includes("png") ? "png" : "jpg";
    const path = `trip-plans/${plan.id}/${stop.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("photos").upload(path, compressed, { contentType: compressed.type, upsert: true });
    if (upErr) return alert(upErr.message);
    const publicUrl = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
    await supabase.from("trip_plan_stops").update({ photo_url: publicUrl, storage_path: path, status: "visited" }).eq("id", stop.id);
    await load();
  }

  async function removeStopPhoto(stop: Stop) {
    if (stop.storage_path) {
      await supabase.storage.from("photos").remove([stop.storage_path]);
    }
    await supabase.from("trip_plan_stops").update({ photo_url: null, storage_path: null, status: "planned" }).eq("id", stop.id);
    await load();
  }

  async function savePlanHeader() {
    if (!plan) return;
    setSaving(true);
    await supabase.from("trip_plans").update({ title: plan.title, description: plan.description }).eq("id", plan.id);
    setSaving(false);
  }

  async function saveStop(stop: Stop) {
    setSaving(true);
    await supabase
      .from("trip_plan_stops")
      .update({ title: stop.title, memo: stop.memo, candidate_options: stop.candidate_options })
      .eq("id", stop.id);
    setSaving(false);
  }

  async function removeStop(stopId: string) {
    if (!confirm("この項目を削除しますか？")) return;
    await supabase.from("trip_plan_stops").delete().eq("id", stopId);
    await load();
  }

  async function reorder(stop: Stop, direction: "up" | "down") {
    const dayItems = stops.filter((s) => s.day_number === stop.day_number).sort((a, b) => a.sort_order - b.sort_order);
    const index = dayItems.findIndex((s) => s.id === stop.id);
    const target = direction === "up" ? dayItems[index - 1] : dayItems[index + 1];
    if (!target) return;
    await supabase.from("trip_plan_stops").update({ sort_order: target.sort_order }).eq("id", stop.id);
    await supabase.from("trip_plan_stops").update({ sort_order: stop.sort_order }).eq("id", target.id);
    await load();
  }

  if (!plan) return <main style={{ padding: 16 }}>読み込み中...</main>;

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "14px 12px 100px" }}>
      <Link href="/plans" style={backBtn}>旅のしおりページに戻る</Link>
      <section style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, marginTop: 10, background: "#fff" }}>
        <input value={plan.title ?? ""} onChange={(e) => setPlan({ ...plan, title: e.target.value })} style={{ ...input, fontSize: 22, fontWeight: 900 }} />
        <textarea value={plan.description ?? ""} onChange={(e) => setPlan({ ...plan, description: e.target.value })} style={{ ...input, marginTop: 8 }} placeholder="旅のコンセプト・説明" />
        <button onClick={() => void savePlanHeader()} style={miniPrimary} disabled={saving}>タイトル/説明を保存</button>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, fontSize: 13, color: "#334155" }}>
          <Info label="日数" value={plan.trip_length_type === "day_trip" ? "日帰り" : `${(plan.nights ?? 1) + 1}日 (${plan.nights ?? 1}泊)`} />
          <Info label="予算" value={`${plan.estimated_cost_min ?? "-"}〜${plan.estimated_cost_max ?? "-"}円`} />
          <Info label="目的地" value={`${plan.destination_1 ?? "-"}${plan.destination_2 ? `・${plan.destination_2}` : ""}`} />
          <Info label="出発地" value={plan.departure_from ?? "-"} />
        </div>
      </section>

      <section style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {Object.entries(grouped).map(([day, list]) => (
          <div key={day} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Day {day} スケジュール</h2>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {list.map((stop, idx) => (
                <article key={stop.id} style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{stop.start_time ?? "--:--"} - {stop.end_time ?? ""} / {stop.category ?? "spot"}</div>
                  <input value={stop.title ?? ""} onChange={(e) => setStops((prev) => prev.map((s) => s.id === stop.id ? { ...s, title: e.target.value } : s))} style={input} />
                  <textarea value={stop.memo ?? ""} onChange={(e) => setStops((prev) => prev.map((s) => s.id === stop.id ? { ...s, memo: e.target.value } : s))} style={{ ...input, marginTop: 6 }} placeholder="メモ" />
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700 }}>候補（最大3件を編集可）</div>
                  {(stop.candidate_options ?? []).slice(0, 3).map((opt: any, i: number) => (
                    <input
                      key={i}
                      value={opt?.name ?? ""}
                      onChange={(e) => setStops((prev) => prev.map((s) => {
                        if (s.id !== stop.id) return s;
                        const next = [...(s.candidate_options ?? [])];
                        next[i] = { ...(next[i] ?? {}), name: e.target.value };
                        return { ...s, candidate_options: next };
                      }))}
                      style={{ ...input, marginTop: 4 }}
                    />
                  ))}
                  {stop.photo_url ? <img src={stop.photo_url} alt="stop" style={{ width: "100%", maxWidth: 240, borderRadius: 10, marginTop: 6 }} /> : null}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button onClick={() => void saveStop(stop)} style={smallBtn}>変更を保存</button>
                    <button onClick={() => void reorder(stop, "up")} style={smallBtn} disabled={idx === 0}>↑</button>
                    <button onClick={() => void reorder(stop, "down")} style={smallBtn} disabled={idx === list.length - 1}>↓</button>
                    <button onClick={() => void removeStop(stop.id)} style={smallBtn}>削除</button>
                    <label style={{ ...smallBtn, cursor: "pointer" }}>
                      写真追加
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && void uploadStopPhoto(stop, e.target.files[0])} />
                    </label>
                    {stop.photo_url ? <button onClick={() => void removeStopPhoto(stop)} style={smallBtn}>写真削除</button> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, color: "#64748b" }}>地図（補助表示）</h3>
        <div style={{ height: 300, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <MapView
            places={mapStops as any}
            onRequestNew={() => {}}
            onSelect={() => {}}
            selectedId={null}
            mode="public"
            showCenterMarker={false}
            initialView={mapStops[0] ? { lat: mapStops[0].lat, lng: mapStops[0].lng, zoom: 10 } : { lat: 35.68, lng: 139.76, zoom: 4 }}
          />
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 8 }}>
      <div style={{ fontSize: 11, color: "#64748b" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const input: React.CSSProperties = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px" };
const smallBtn: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", borderRadius: 999, padding: "6px 10px", fontWeight: 700, fontSize: 12 };
const backBtn: React.CSSProperties = { display: "inline-block", border: "1px solid #cbd5e1", borderRadius: 999, padding: "8px 12px", textDecoration: "none", color: "#0f172a", fontWeight: 700, fontSize: 13 };
const miniPrimary: React.CSSProperties = { ...smallBtn, marginTop: 8, background: "#0f172a", color: "#fff", border: "none" };
