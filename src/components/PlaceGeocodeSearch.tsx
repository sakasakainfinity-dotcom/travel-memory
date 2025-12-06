// src/components/PlaceGeocodeSearch.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  onPick: (p: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
  }) => void;
  onReset?: () => void;
};

type SearchResult = {
  name: string;
  lat: number;
  lon: number;
  address?: string;
};

export default function PlaceGeocodeSearch({ onPick, onReset }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  async function run() {
    const raw = q.trim();
    if (!raw) return;

    if (onReset) onReset();

    setLoading(true);
    setOpen(true);
    setItems([]);

    try {
      // 「旭川 旭山動物園」みたいなのを分割
      const parts = raw.split(/\s+/);
      let area = raw;
      let keyword = "";

      if (parts.length >= 2) {
        area = parts[0];                    // 例: 旭川
        keyword = parts.slice(1).join(" "); // 例: 旭山動物園
      }

      // -------- Step1: ジオコーディング（エリア） --------
      const geoRes = await fetch(
        `/api/yahoo-geocode?q=${encodeURIComponent(area)}`
      );
      const geo = await geoRes.json();

      let results: SearchResult[] = [];

      if (geo.lat && geo.lon) {
        const baseLat = geo.lat;
        const baseLon = geo.lon;

        // -------- Step2: 周辺POI検索 --------
        const poiQuery = keyword || raw;
        const poiRes = await fetch(
          `/api/yahoo-poi?lat=${baseLat}&lon=${baseLon}&q=${encodeURIComponent(
            poiQuery
          )}&dist=30` // ← 5kmから30kmに広げて郊外の観光地も拾う
        );
        const poiJson = await poiRes.json();

        if (poiJson.items && poiJson.items.length > 0) {
          results = poiJson.items.map((it: any) => ({
            name: it.name,
            lat: it.lat,
            lon: it.lon,
            address: it.address,
          }));
        } else {
          // POIゼロでも、ジオコーダが成功してればその地点だけ候補にする
          results = [
            {
              name: geo.name || raw,
              lat: baseLat,
              lon: baseLon,
              address: geo.raw?.Property?.Address,
            },
          ];
        }
      }

      // -------- Step3: Supabase places（publicのみ） --------
      const { data: pub, error: pubError } = await supabase
        .from("places")
        .select("title, lat, lng, visibility")
        .eq("visibility", "public")
        .ilike("title", `%${raw}%`)
        .limit(20);

      if (pubError) {
        console.error("Supabase ERROR:", pubError);
      }

      const pubResults: SearchResult[] =
        (pub ?? []).map((p: any) => ({
          name: p.title,
          lat: p.lat,
          lon: p.lng,
          address: "（投稿データ）",
        })) ?? [];

      // Yahoo結果 + public投稿候補を合体
      setItems([...results, ...pubResults]);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function pick(it: SearchResult) {
    setOpen(false);
    onPick({
      lat: it.lat,
      lng: it.lon,
      name: it.name,
      address: it.address,
    });
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <div style={{ position: "relative" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder="例：旭川 旭山動物園 / 大子町 ファミマ / 東京タワー"
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid #ddd",
            padding: "8px 32px 8px 10px",
          }}
        />

        <button
          type="button"
          onClick={run}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          🔍
        </button>
      </div>

      {/* 結果リスト */}
      {open && (
        <div
          style={{
            marginTop: 6,
            maxHeight: 220,
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fff",
          }}
        >
          {loading && (
            <div style={{ padding: 10, fontSize: 12, color: "#6b7280" }}>
            検索中…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ padding: 10, fontSize: 12, color: "#9ca3af" }}>
              該当する場所が見つかりませんでした
            </div>
          )}

          {!loading &&
            items.map((it, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => pick(it)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: "none",
                  borderBottom:
                    idx === items.length - 1 ? "none" : "1px solid #eee",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{it.name}</div>
                {it.address && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      marginTop: 2,
                    }}
                  >
                    {it.address}
                  </div>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}


