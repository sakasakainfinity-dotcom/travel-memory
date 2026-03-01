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
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 4 }));
const setViewRef = useRef<(v: View) => void>(() => {});
  // 👇 CTA表示制御
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCTA(true);
    }, 10000); // 10秒後に表示

    return () => clearTimeout(timer);
  }, []);

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

  const selected = selectedId ? places.find((p) => p.id === selectedId) : null;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100svh",
        background: "linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
      }}
    >
      {/* 👇 左上CTA（最初は透明、10秒後フェードイン） */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 60,
          opacity: showCTA ? 1 : 0,
          transition: "opacity 1.2s ease",
        }}
      >
        <button
          onClick={() => router.push("/login")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(2,6,23,0.45)",
            backdropFilter: "blur(6px)",
            color: "rgba(226,232,240,0.9)",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 0.2,
          }}
        >
          ✨ あなたの思い出も地図に残しませんか？
        </button>
      </div>

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

        {loading && <div style={{ marginTop: 10, fontSize: 12 }}>読み込み中…</div>}
        {err && <div style={{ marginTop: 10, fontSize: 12, color: "#fb7185" }}>エラー: {err}</div>}
      </div>

      {/* マップ本体 */}
      <div style={{ height: "calc(100svh - 86px)", position: "relative" }}>
        <MapView
          places={places as any}
          onRequestNew={() => alert("この共有マップでは投稿できません")}
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

        {selected && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 12,
              background: "rgba(2,6,23,0.92)",
              borderRadius: 16,
              padding: 12,
              zIndex: 20,
            }}
          >
            <div style={{ fontWeight: 900 }}>
              {(selected as any).title ?? (selected as any).name ?? "（タイトルなし）"}
            </div>

            {selected.memo && (
              <div style={{ marginTop: 8, lineHeight: 1.6 }}>
                {selected.memo}
              </div>
            )}

            {selected.photos?.length && (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                {selected.photos.map((url, i) => (
                  <img
                    key={url + i}
                    src={url}
                    alt=""
                    onClick={() => setOpenPhoto(url)}
                    style={{
                      width: 110,
                      height: 90,
                      objectFit: "cover",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {openPhoto && (
          <div
            onClick={() => setOpenPhoto(null)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <img
              src={openPhoto}
              alt=""
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 14 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
