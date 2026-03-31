"use client";

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

  if (!plan) return <main style={{ padding: 16 }}>読み込み中...</main>;

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "14px 12px 100px" }}>
      <h1 style={{ fontWeight: 900, fontSize: 24 }}>{plan.title}</h1>
      <p style={{ color: "#475569", whiteSpace: "pre-wrap" }}>{plan.description}</p>
      <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
        出発地: {plan.departure_from ?? "-"} / 人数: {plan.people_count ?? "-"} / 関係性: {plan.relationship ?? "-"}<br />
        日程: {plan.trip_length_type === "day_trip" ? "日帰り" : `${plan.nights ?? 1}泊`} / 目的地: {plan.destination_1 ?? "-"} {plan.destination_2 ? `・${plan.destination_2}` : ""}<br />
        絶対にしたいこと: {plan.must_do ?? "-"}<br />
        予算: {plan.estimated_cost_min ?? "-"}〜{plan.estimated_cost_max ?? "-"}円 / visibility: {plan.visibility}
      </div>

      <div style={{ height: 320, marginTop: 12, borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
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

      <section style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {Object.entries(grouped).map(([day, list]) => (
          <div key={day} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Day {day}</h2>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {list.map((stop) => (
                <article key={stop.id} style={{ border: "1px solid #f1f5f9", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{stop.start_time ?? "--:--"} - {stop.end_time ?? ""} / {stop.category ?? "spot"} / {stop.status}</div>
                  <div style={{ fontWeight: 800 }}>{stop.title}</div>
                  {stop.memo ? <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{stop.memo}</div> : null}
                  {stop.candidate_options?.length ? (
                    <ul style={{ fontSize: 12 }}>
                      {stop.candidate_options.slice(0, 2).map((opt: any, i: number) => (
                        <li key={i}>{opt.name} {opt.address ? `(${opt.address})` : ""}</li>
                      ))}
                    </ul>
                  ) : null}
                  {stop.photo_url ? <img src={stop.photo_url} alt="stop" style={{ width: "100%", maxWidth: 240, borderRadius: 10, marginTop: 6 }} /> : null}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
    </main>
  );
}

const smallBtn: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 700,
  fontSize: 12,
};
