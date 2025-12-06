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
  /** 検索やり直し時にフォーム側をリセットしたいとき用（任意） */
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

    // 親フォームのタイトル／住所などをリセット
    onReset?.();

    setLoading(true);
    setOpen(true);
    setItems([]);

    try {
      // ---------- まず Yahoo 側（ジオコーダ＋ローカルサーチ＋場所情報API） ----------
      const params = new URLSearchParams({ q: raw });
      const res = await fetch(`/api/place-search?${params.toString()}`);
      const json: any = await res.json();

      let results: SearchResult[] = Array.isArray(json.items) ? json.items : [];

      // ---------- Supabase の public places も混ぜる ----------
      const { data: pub } = await supabase
        .from("places")
        .select("title, lat, lng, visibility")
        .eq("visibility", "public")
        .ilike("title", `%${raw}%`);

      const pubResults: SearchResult[] =
        pub
          ?.filter(
            (p: any) =>
              typeof p.lat === "number" && typeof p.lng === "number"
          )
          .map((p: any) => ({
            name: p.title || "(タイトル未設定)",
            lat: p.lat,
            lon: p.lng,
            address: "（みんなの投稿）",
          })) ?? [];

      // Yahoo + public を合体して、重複を削る
      const merged = [...results, ...pubResults];
      const seen = new Set<string>();
      const uniq = merged.filter((it) => {
        const key = `${it.name}|${it.lat.toFixed(6)}|${it.lon.toFixed(6)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setItems(uniq);
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
      {/* ラベルは外側 (page.tsx) に任せる。ここでは input だけ。 */}
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
          placeholder="例：東京タワー / 姫路城 / 山梨 ラーメン"
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
                key={`${it.name}-${idx}`}
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
