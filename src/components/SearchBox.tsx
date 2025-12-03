"use client";

import { useState, useRef } from "react";

export default function SearchBox({
  onPick,
}: {
  onPick: (p: { lat: number; lng: number; label?: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  async function search() {
    if (!q.trim()) return;

    setOpen(true);

    // Step1：ジオコーディング（あいまい座標）
    const geoRes = await fetch(`/api/yahoo-geocode?q=${encodeURIComponent(q)}`);
    const geo = await geoRes.json();

    if (!geo.lat) {
      setItems([]);
      return;
    }

    // Step2：周辺POI検索
    const poiRes = await fetch(
      `/api/yahoo-poi?lat=${geo.lat}&lon=${geo.lon}&q=${encodeURIComponent(q)}`
    );
    const poi = await poiRes.json();

    if (poi.items.length === 0) {
      // 苦し紛れに座標だけ返す
      setItems([
        {
          name: geo.name || q,
          lat: geo.lat,
          lon: geo.lon,
        },
      ]);
      return;
    }

    setItems(poi.items);
  }

  function pick(it: any) {
    setOpen(false);
    setQ(it.name);
    onPick({ lat: it.lat, lng: it.lon, label: it.name });
  }

  return (
    <div style={{ position: "relative", width: 360 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="場所を検索（例： 月待の滝）"
        onKeyDown={(e) => {
          if (e.key === "Enter") search();
        }}
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #ddd",
          padding: "10px 12px",
        }}
      />

      {open && items.length > 0 && (
        <div
          style={{
            position: "absolute",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            marginTop: 4,
            width: "100%",
            zIndex: 99999,
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => pick(it)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: 10,
                border: "none",
                background: "white",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {it.address || "周辺候補"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
