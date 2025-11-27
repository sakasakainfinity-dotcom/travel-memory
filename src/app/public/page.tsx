// src/app/public/page.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import type { Place as MapPlace } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function PublicMapPage() {
  // ★ 型をちゃんと指定する：ここが今回のエラーの原因
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // visibility="public" の place を全部取る（space_id は絞らない）
      const { data, error } = await supabase
        .from("places")
        .select("id, title, memo, lat, lng, visibility")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setPlaces(
        (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.title,
          memo: p.memo ?? undefined,
          lat: p.lat,
          lng: p.lng,
          visibility: p.visibility ?? "public",
          photos: [], // ここで写真まで見せたくなったら photo join 足せばOK
        }))
      );
    })();
  }, []);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 10000,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        🌏 公開マップ（みんなの青ピン）
      </div>

      <MapView
        places={places}
        onRequestNew={() => {
          // 公開マップは閲覧専用：ダブルクリックで投稿は無効化
          alert("これは公開ビューだから、ここからは投稿できんよ！（マイマップ側で投稿してね）");
        }}
        selectedId={selectedId}
        onSelect={(p) => setSelectedId(p.id)}
      />
    </>
  );
}
