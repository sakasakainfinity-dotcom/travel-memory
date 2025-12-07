// src/components/SearchBox.tsx
"use client";

import { useMemo, useState } from "react";

type LocalPlace = {
  id: string;
  name?: string | null;
  memo?: string | null;
  lat: number;
  lng: number;
};

type Props = {
  places: LocalPlace[];
  onPick: (p: { id?: string; lat: number; lng: number; zoom?: number }) => void;
};

export default function SearchBox({ places, onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return places
      .filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        const memo = (p.memo ?? "").toLowerCase();
        return name.includes(query) || memo.includes(query);
      })
      .slice(0, 20);
  }, [q, places]);

  const pick = (p: LocalPlace) => {
    setOpen(false);
    setQ(p.name ?? "");
    onPick({ id: p.id, lat: p.lat, lng: p.lng, zoom: 15 });
  };

    return (
  <div
    style={{
      position: "relative",
      width: "100%",
      maxWidth: "100%",
    }}
  >
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) pick(results[0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="投稿内容を検索（タイトル・メモ）"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "rgba(255,255,255,0.95)",
          padding: "8px 10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          fontSize: 13,
        }}
      />

      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "110%",
            zIndex: 12000,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                border: "none",
                background: "#fff",
                borderBottom: "1px solid #eee",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {p.name || "無題の投稿"}
              </div>
              {p.memo && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#6b7280",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.memo}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

