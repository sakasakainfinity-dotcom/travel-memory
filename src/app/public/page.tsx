// src/app/public/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Place as MapPlace } from "@/components/MapView";
import { useRouter } from "next/navigation";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = { lat: number; lng: number; zoom: number };

export default function PublicPage() {
  const router = useRouter();

  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [initialView, setInitialView] = useState<View | undefined>(undefined);

  const getViewRef = useRef<() => View>(() => ({ lat: 35.68, lng: 139.76, zoom: 4 }));
  const setViewRef = useRef<(v: View) => void>(() => {});

  // 🔹 公開投稿だけを全ユーザー分取得
  useEffect(() => {
    (async () => {
      try {
        // places: visibility = 'public' だけ
        const { data, error } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, visibility")
          .eq("visibility", "public")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data ?? []) as any[];
        const ids = rows.map((p) => p.id as string);

        // 写真をまとめて取得
        let photosBy: Record<string, string[]> = {};
        if (ids.length > 0) {
          const { data: phs, error: ePh } = await supabase
            .from("photos")
            .select("place_id, file_url")
            .in("place_id", ids);

          if (ePh) throw ePh;

          for (const ph of phs ?? []) {
            const pid = (ph as any).place_id as string;
            const url = (ph as any).file_url as string;
            (photosBy[pid] ||= []).push(url);
          }
        }

        // MapView 用の型に整形
        setPlaces(
          rows.map((p) => ({
            id: p.id,
            name: p.title,
            memo: p.memo ?? undefined,
            lat: p.lat,
            lng: p.lng,
            visibility: p.visibility ?? "public",
            photos: photosBy[p.id] ?? [],
          }))
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const selected = useMemo(
    () => places.find((x) => x.id === selectedId) || null,
    [places, selectedId]
  );

  return (
  <>
    {/* 右上トグル：Publicページ版（Publicがアクティブ） */}
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 10px)",
        right: "max(12px, env(safe-area-inset-right, 0px))",
        zIndex: 10001,
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          borderRadius: 999,
          border: "1px solid #111827",
          overflow: "hidden",
          background: "#fff",
          fontSize: 12,
        }}
      >
        {/* ← Private 側（今回は非アクティブ） */}
        <button
          type="button"
          onClick={() => router.push("/")} // ★Privateへ
          style={{
            padding: "6px 14px",
            border: "none",
            background: "#ffffff",
            color: "#111827",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "999px",
              background: "#22c55e", // 緑
            }}
          />
          Private
        </button>

        {/* → Public 側（アクティブ） */}
        <div
          style={{
            padding: "6px 14px",
            background: "#111827",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "999px",
              background: "#2563eb", // 青
            }}
          />
          Public
        </div>
      </div>
    </div>

  

      {/* 🗺 公開マップ本体 */}
      <MapView
        places={places}
        onRequestNew={() => {
          // 公開マップでは投稿禁止（投稿は / 側で）
          alert("公開マップでは投稿できんよ。自分のマップ（Private）で投稿してね。");
        }}
        onSelect={(p) => setSelectedId(p.id)}
        selectedId={selectedId}
        flyTo={flyTo}
        bindGetView={(fn) => {
          getViewRef.current = fn;
        }}
        bindSetView={(fn) => {
          setViewRef.current = fn;
        }}
        initialView={initialView}
      />

      {/* 必要なら private 側と同じ「下プレビュー」をあとでコピペすればOK */}
      {selected && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 10,
            width: "min(980px, 96vw)",
            maxHeight: "72vh",
            background: "rgba(255,255,255,0.98)",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 18px 50px rgba(0,0,0,.25)",
            zIndex: 9000,
            padding: 12,
            pointerEvents: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 18,
                lineHeight: 1.2,
                maxWidth: "90%",
                margin: "0 auto",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "0.02em",
              }}
              title={selected.name || "無題"}
            >
              {selected.name || "無題"}
            </div>
          </div>

          <SearchBox
  places={publicPlaces}   // 公開側の配列
  onPick={(p) => setFlyTo(p)} // MapView の中心移動
/>

          <button
            onClick={() => setSelectedId(null)}
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <div
            style={{
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.5,
              maxHeight: "16vh",
              overflow: "auto",
            }}
          >
            {selected.memo || "（メモなし）"}
          </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8,
                overflowY: "auto",
                flex: 1,
              }}
            >
              {(selected.photos ?? []).length === 0 && (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>写真はまだありません</div>
              )}
              {(selected.photos ?? []).map((u) => (
                <img
                  key={u}
                  src={u}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "24vh",
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "1px solid #eee",
                  }}
                  alt=""
                />
              ))}
            </div>
        </div>
      )}
    </>
  );
}
