// src/app/public/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function PublicPage() {
  const [places, setPlaces] = useState([]);

  // 初回ロード：visibility = public を取得
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("places")
        .select("id, title, memo, lat, lng, visibility")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      setPlaces(
        (data ?? []).map((p) => ({
          id: p.id,
          name: p.title,
          memo: p.memo ?? undefined,
          lat: p.lat,
          lng: p.lng,
          visibility: p.visibility ?? "public",
          photos: [],
        }))
      );

      // 写真の取得
      const ids = (data ?? []).map((p) => p.id);
      if (ids.length > 0) {
        const { data: ph } = await supabase
          .from("photos")
          .select("place_id, file_url")
          .in("place_id", ids);

        const by: Record<string, string[]> = {};
        for (const row of ph ?? []) {
          (by[row.place_id] ||= []).push(row.file_url);
        }

        setPlaces((prev) =>
          prev.map((p: any) => ({
            ...p,
            photos: by[p.id] ?? [],
          }))
        );
      }
    })();
  }, []);

  return (
    <>
      {/* 🔘 切り替えスイッチ */}
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 10000 }}>
        <a
          href="/"
          style={{
            padding: "6px 10px",
            borderRadius: 20,
            background: "#fff",
            border: "1px solid #ddd",
            fontSize: 13,
          }}
        >
          🔒 マイマップへ戻る
        </a>
      </div>

      <MapView places={places} />
    </>
  );
}
