"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapView from "@/components/MapView";

type Place = {
  id: string;
  lat: number;
  lng: number;
  title: string | null;
  memo: string | null;
  address?: string | null;
  created_at?: string | null;
  visibility?: "public" | "private" | "pair";
  photos?: string[];
};

type View = { lat: number; lng: number; zoom: number };

export default function ShareMapPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [initialView, setInitialView] = useState<View | undefined>(undefined);

  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 4 }));
  const setViewRef = useRef<(v: View) => void>(() => {});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" });
        const text = await res.text();
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {}

        if (!res.ok) throw new Error(json?.error ?? text ?? `fetch failed (${res.status})`);

        const ps: Place[] = json?.places ?? [];
        setPlaces(ps);

        if (ps.length > 0) {
          setInitialView({ lat: ps[0].lat, lng: ps[0].lng, zoom: 5 });
        } else {
          setInitialView({ lat: 35.68, lng: 139.76, zoom: 4 });
        }
      } catch (e: any) {
        setErr(e?.message ?? "unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ✅ ここが正しい置き場所（returnの外）
  const selected = selectedId ? places.find((p) => p.id === selectedId) : null;

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
      }}
    >
      {/* ヘッダー */}
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>共有マップ</div>
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.65)", marginTop: 2 }}>
              公開（public）の投稿のみ表示（閲覧のみ）
            </div>
          </div>

          <button
            onClick={() => router.back()}
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(226,232,240,0.9)",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ← 戻る
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(226,232,240,0.75)" }}>読み込み中…</div>
        )}
        {err && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#fb7185", fontWeight: 900 }}>エラー: {err}</div>
        )}
        {!loading && !err && (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(226,232,240,0.7)" }}>
            投稿数: {places.length}
          </div>
        )}
      </div>

      {/* マップ本体（relative必須：下の詳細カードを重ねるため） */}
      <div style={{ height: "calc(100svh - 86px)", position: "relative" }}>
        <MapView
          places={places as any}
          onRequestNew={() => alert("この共有マップでは投稿できんよ。自分のマップ（Private）で投稿してね。")}
          onSelect={(p: any) => setSelectedId(p.id)}
          selectedId={selectedId}
          flyTo={flyTo}
          bindGetView={(fn: any) => {
            getViewRef.current = fn;
          }}
          bindSetView={(fn: any) => {
            setViewRef.current = fn;
          }}
          initialView={initialView as any}
          mode="public"
        />

        {/* ✅ 選択した投稿の詳細（ここに置く） */}
        {selected && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              background: "rgba(2,6,23,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: 12,
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontWeight: 900 }}>{selected.title ?? "（タイトルなし）"}</div>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(226,232,240,0.9)",
                  padding: "6px 10px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                閉じる
              </button>
            </div>

            {selected.memo && (
              <div style={{ marginTop: 8, color: "rgba(226,232,240,0.9)", lineHeight: 1.6 }}>
                {selected.memo}
              </div>
            )}

            {selected.photos?.length ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                {selected.photos.map((url, i) => (
                  <img
                    key={url + i}
                    src={url}
                    alt=""
                    style={{
                      width: 110,
                      height: 90,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      flex: "0 0 auto",
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 12, color: "rgba(226,232,240,0.65)" }}>
                写真がありません
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
