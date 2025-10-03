// src/components/SearchBox.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Suggest = { display_name: string; lat: string; lon: string };

export default function SearchBox({
  onPick,
}: {
  onPick: (p: { lat: number; lng: number; zoom?: number }) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggest[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  // 入力→Nominatim（APIキー不要）
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!q.trim()) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "json");
        url.searchParams.set("addressdetails", "0");
        url.searchParams.set("limit", "5");
        url.searchParams.set("accept-language", "ja");
        const res = await fetch(url.toString());
        const json = (await res.json()) as Suggest[];
        setItems(json);
        setOpen(true);
      } catch (e) {
        console.error(e);
        setItems([]);
        setOpen(false);
      }
    }, 300);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q]);

  const pick = (s: Suggest) => {
    setOpen(false);
    setQ(s.display_name);
    onPick({ lat: Number(s.lat), lng: Number(s.lon), zoom: 13 });
  };

  const list = useMemo(() => items, [items]);

  // このコンポーネント配下はイベント全部ここで止める（地図に渡さない）
  const stopAll = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        zIndex: 11000, // 最前面
        pointerEvents: "auto",
      }}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onClick={stopAll}
      onWheel={stopAll}
      onTouchStart={stopAll}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => list.length && setOpen(true)}
        placeholder="場所を検索（例：広島、尾道、厳島神社）"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "rgba(255,255,255,0.95)",
          padding: "10px 12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      />
      {open && list.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "110%",
            zIndex: 12000, // 候補はさらに上
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
          }}
          onMouseDown={stopAll}
          onMouseUp={stopAll}
          onClick={stopAll}
          onWheel={stopAll}
          onTouchStart={stopAll}
        >
          {list.map((s, i) => (
            <button
              key={`${s.lat}-${s.lon}-${i}`}
              type="button"
              // ★ ここが決め手：onMouseDown で即 pick
              onMouseDown={(e) => {
                e.preventDefault(); // フォーカス移動で閉じる前に確定
                e.stopPropagation(); // 地図に渡さない
                pick(s);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "white",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{s.display_name.split(",")[0]}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{s.display_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

