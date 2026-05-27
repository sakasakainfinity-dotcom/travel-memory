"use client";

import { useEffect, useState } from "react";
import MapView from "@/components/MapView";

type Place = {
  id: string;
  name?: string;
  title?: string;
  memo?: string;
  lat: number;
  lng: number;
  photos?: string[];
  visibility?: "public";
};

export default function SpotPublicClient({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("スポットまとめ");
  const [description, setDescription] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState("名無しの旅人");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/spot/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "読み込み失敗");

        setTitle(json?.collection?.title ?? "スポットまとめ");
        setDescription(json?.collection?.description ?? null);
        setCreatorName(json?.collection?.creatorName ?? "名無しの旅人");
        setPlaces((json?.places ?? []) as Place[]);
      } catch (e: any) {
        setErr(e?.message ?? "読み込み失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const selected = selectedId ? places.find((p) => p.id === selectedId) : null;
  const cover = places[0]?.photos?.[0] ?? null;

  return (
    <div style={{ minHeight: "100svh", background: "#020617", color: "#f8fafc" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>{title}</h1>
        <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>作成者: {creatorName}</div>
        {description && <p style={{ marginTop: 0, color: "#e2e8f0" }}>{description}</p>}
        {cover ? (
          <img src={cover} alt="カバー画像" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} />
        ) : (
          <div style={{ height: 160, borderRadius: 12, background: "#1e293b", display: "grid", placeItems: "center", color: "#94a3b8", marginBottom: 10 }}>No photo</div>
        )}
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>地図上のカメラをタップすると写真が見られます</div>

        <div style={{ height: 420, borderRadius: 12, overflow: "hidden", border: "1px solid #1e293b", position: "relative" }}>
          <MapView
            places={places as any}
            onRequestNew={() => {}}
            onSelect={(p: any) => setSelectedId(p.id)}
            selectedId={selectedId}
            mode="public"
            initialView={places[0] ? { lat: places[0].lat, lng: places[0].lng, zoom: 6 } : { lat: 35.68, lng: 139.76, zoom: 4 }}
          />
          {selected && (
            <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 15, background: "rgba(2,6,23,0.92)", borderRadius: 12, padding: 10 }}>
              <div style={{ fontWeight: 800 }}>{selected.title || selected.name || "無題"}</div>
              {selected.memo && <div style={{ marginTop: 4, color: "#cbd5e1", fontSize: 13 }}>{selected.memo}</div>}
              {(selected.photos?.length ?? 0) > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, overflowX: "auto" }}>
                  {selected.photos?.map((ph, i) => (
                    <img key={`${ph}-${i}`} src={ph} alt="" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 8 }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 14, marginBottom: 8 }}>投稿一覧</h2>
        {loading && <div>読み込み中…</div>}
        {err && <div style={{ color: "#fb7185" }}>エラー: {err}</div>}
        {!loading && !err && places.length === 0 && <div style={{ color: "#94a3b8" }}>このまとめに表示できる投稿はありません。</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 10, marginBottom: 24 }}>
          {places.map((p, idx) => (
            <article key={p.id} style={{ border: "1px solid #1e293b", borderRadius: 10, overflow: "hidden", background: "#0f172a" }}>
              {p.photos?.[0] ? (
                <img src={p.photos[0]} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
              ) : (
                <div style={{ height: 120, display: "grid", placeItems: "center", color: "#64748b" }}>No photo</div>
              )}
              <div style={{ padding: 8 }}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>#{idx + 1}</div>
                <div style={{ fontWeight: 700 }}>{p.title || p.name || "無題"}</div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{p.memo || "（メモなし）"}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
