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
  /** 地図の中心やピンの位置など「基準にしたい座標」 */
  baseLat?: number;
  baseLng?: number;
};

type SearchResult = {
  name: string;
  lat: number;
  lon: number;
  address?: string;
};

export default function PlaceGeocodeSearch({
  onPick,
  onReset,
  baseLat,
  baseLng,
}: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);

  // ---------- Yahoo POI ----------
  const searchPoi = async (
    lat: number,
    lon: number,
    query: string,
    dist: number
  ): Promise<SearchResult[]> => {
    const res = await fetch(
      `/api/yahoo-poi?lat=${lat}&lon=${lon}&q=${encodeURIComponent(
        query
      )}&dist=${dist}`
    );
    const json = await res.json();

    if (!json.items || json.items.length === 0) return [];
    return json.items.map((it: any) => ({
      name: it.name,
      lat: it.lat,
      lon: it.lon,
      address: it.address,
    }));
  };

  // ---------- Supabase places（publicのみ） ----------
  const searchPublicPlaces = async (query: string): Promise<SearchResult[]> => {
    const { data, error } = await supabase
      .from("places")
      .select("title, lat, lng, visibility")
      .eq("visibility", "public")
      .ilike("title", `%${query}%`)
      .limit(20);

    if (error) {
      console.error("Supabase ERROR:", error);
      return [];
    }

    return (
      data?.map((p: any) => ({
        name: p.title,
        lat: p.lat,
        lon: p.lng,
        address: "（投稿データ）",
      })) ?? []
    );
  };

  // ---------- メイン処理 ----------
  async function run() {
    const raw = q.trim();
    if (!raw) return;

    if (onReset) onReset();

    setLoading(true);
    setOpen(true);
    setItems([]);

    try {
      const parts = raw.split(/\s+/);
      let results: SearchResult[] = [];

      // ====== パターン①：エリア＋キーワード（例：旭川 旭山動物園） ======
      if (parts.length >= 2) {
        const area = parts[0];
        const keyword = parts.slice(1).join(" ");

        try {
          const geoRes = await fetch(
            `/api/yahoo-geocode?q=${encodeURIComponent(area)}`
          );
          const geo = await geoRes.json();

          if (geo.lat && geo.lon) {
            const baseLatFromArea = geo.lat;
            const baseLonFromArea = geo.lon;
            // 市区町村基準 → 半径30km
            results = await searchPoi(
              baseLatFromArea,
              baseLonFromArea,
              keyword,
              30
            );
          }
        } catch (e) {
          console.error("geocode error", e);
        }
      }

      // ====== パターン②：キーワードだけ（例：琵琶湖 / 東京タワー） ======
      if (results.length === 0) {
        let centerLat: number;
        let centerLon: number;
        let dist: number;

        if (baseLat != null && baseLng != null) {
          // 地図の中心があるならそこを基準（80km）
          centerLat = baseLat;
          centerLon = baseLng;
          dist = 80;
        } else {
          // なければ日本全体ざっくり検索
          centerLat = 37.5;
          centerLon = 137.5;
          dist = 1000;
        }

        results = await searchPoi(centerLat, centerLon, raw, dist);
      }

      // ====== Yahoo側がゼロだった場合の簡易フォールバック ======
      if (results.length === 0 && baseLat != null && baseLng != null) {
        results = [
          {
            name: raw,
            lat: baseLat,
            lon: baseLng,
            address: undefined,
          },
        ];
      }

      // ====== Supabase public places もマージ ======
      const pubResults = await searchPublicPlaces(raw);

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
          placeholder="例：旭川 旭山動物園 / 琵琶湖 / 東京タワー"
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

