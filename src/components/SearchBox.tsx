// src/components/SearchBox.tsx
"use client";

import { useMemo, useRef, useState } from "react";

type LocalPlace = {
  id: string;
  name?: string | null;
  memo?: string | null;
  lat: number;
  lng: number;
};

export default function SearchBox({
  places,
  onPick,
}: {
  places: LocalPlace[];
  onPick: (p: { id: string; lat: number; lng: number; zoom?: number }) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");

  // 投稿（places）をローカルで絞り込み
  const results = useMemo(() => {
    const nq = normalize(q);
    if (!nq) return [];
    return places
      .filter((p) => {
        const t = normalize(p.name ?? "");
        const m = normalize(p.memo ?? "");
        return t.includes(nq) || m.includes(nq);
      })
      .slice(0, 20);
  }, [q, places]);

  const pick = (p: LocalPlace) => {
    const label = p.name || p.memo || "";
    if (label) setQ(label);
    setOpen(false);
    onPick({ id: p.id, lat: p.lat, lng: p.lng, zoom: 15 });
  };

  const handleSearch = () => {
    if (results.length > 0) {
      pick(results[0]);
    } else {
      inputRef.current?.focus();
    }
  };

  const stopAll = (e: any) => e.stopPropagation();

  const handleClear = () => {
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div
      style={{
        position: "relative",
        width: 360,
        zIndex: 11000,
        pointerEvents: "auto",
      }}
      onMouseDown={stopAll}
      onMouseUp={stopAll}
      onClick={stopAll}
      onWheel={stopAll}
      onTouchStart={stopAll}
    >
      <div style={{ position: "relative" }}>
        {q && (
          <button
            type="button"
            aria-label="入力をクリア"
            onClick={handleClear}
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 6,
              fontSize: 16,
              color: "#6b7280",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}

        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            } else if (e.key === "Escape") {
              if (open) setOpen(false);
              else handleClear();
            }
          }}
          placeholder="投稿から検索（タイトル・メモ）"
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "rgba(255,255,255,0.95)",
            padding: "10px 40px 10px 34px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}
        />

        <button
          type="button"
          aria-label="検索"
          onClick={handleSearch}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 6,
            fontSize: 16,
            color: "#374151",
            lineHeight: 1,
          }}
        >
          🔍
        </button>
      </div>

      {/* サジェスト */}
      {open && (
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
            maxHeight: 280,
            display: results.length > 0 ? "block" : q ? "block" : "none",
          }}
          onMouseDown={stopAll}
          onMouseUp={stopAll}
          onClick={stopAll}
          onWheel={stopAll}
          onTouchStart={stopAll}
        >
          {results.length === 0 && q ? (
            <div
              style={{
                padding: "10px 12px",
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              投稿が見つからんかった…（タイトルかメモにそのワード入っとる？）
            </div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  pick(p);
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
                <div style={{ fontWeight: 600 }}>{p.name || "無題"}</div>
                {p.memo && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.memo}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}




