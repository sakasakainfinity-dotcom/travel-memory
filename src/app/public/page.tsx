// src/app/public/page.tsx
"use client";

import { useEffect, useState } from "react";
import MapView, { Place as MapPlace } from "@/components/MapView";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function PublicPage() {
  const router = useRouter();
  const [places, setPlaces] = useState<MapPlace[]>([]); // ★ここ重要

  useEffect(() => {
    (async () => {
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
          photos: [], // 必要なら後で photo JOIN 足す
        }))
      );
    })();
  }, []);

  return (
    <>
      {/* 右上トグル（public 側） */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: "max(12px, env(safe-area-inset-right, 0px))",
          zIndex: 11000,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            borderRadius: 999,
            border: "1px solid #d1d5db",
            overflow: "hidden",
            background: "#fff",
            fontSize: 12,
          }}
        >
          {/* Private 側ボタン（ここではOFF） */}
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              padding: "6px 10px",
              border: "none",
              background: "#fff",
              color: "#6b7280",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                border: "1px solid #9ca3af",
              }}
            />
            Private
          </button>

          {/* Public 側ボタン（ここではON） */}
          <button
            type="button"
            style={{
              padding: "6px 10px",
              border: "none",
              background: "#0f172a",
              color: "#fff",
              cursor: "default",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                background: "#22c55e",
              }}
            />
            Public
          </button>
        </div>
      </div>

      {/* 🗺 マップ */}
      <MapView
        places={places}
        onRequestNew={() => {
          // 公開ページでは「新規投稿」は禁止にしてもいい
          alert("公開モードでは投稿できません。マイマップ側から追加してね。");
        }}
        onSelect={() => {}}
      />
    </>
  );
}
