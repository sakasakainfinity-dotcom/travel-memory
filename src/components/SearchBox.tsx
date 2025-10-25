// src/components/SearchBox.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Suggest = { display_name: string; lat: string; lon: string };

export default function SearchBox({
  onPick,
}: {
  onPick: (p: { lat: number; lng: number; zoom?: number; label?: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggest[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 入力→Nominatim（APIキー不要）: デバウンスで候補表示
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
        const res = await fetch(url.toString(), {
          headers: { "Accept": "application/json" },
        });
        const json = (await res.json()) as Suggest[];
        setItems(json);
        setOpen(json.length > 0);
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

  // 候補のクリック（押下）時
  const pick = (s: Suggest) => {
    setOpen(false);
    setQ(s.display_name);
    onPick({ lat: Number(s.lat), lng: Number(s.lon), zoom: 17, label: s.display_name });
  };

  // 候補がなくても Enter/🔍 で検索実行 → 先頭ヒット or 直叩き
  const runSearch = async () => {
    const query = q.trim();
    if (!query) return;

    // 既に候補があれば最上位を採用
    if (items.length > 0) {
      pick(items[0]);
      return;
    }

    // 候補未取得 or 0件のとき、ワンショットでジオコーディング
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "0");
      url.searchParams.set("limit", "1");
      url.searchParams.set("accept-language", "ja");
      const res = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
      const json = (await res.json()) as Suggest[];
      if (json.length > 0) {
        pick(json[0]);
      } else {
        // 見つからん時はそのままフォーカス維持して終了
        inputRef.current?.focus();
      }
    } catch (e) {
      console.error(e);
      inputRef.current?.focus();
    }
  };

  const list = useMemo(() => items, [items]);

  // このコンポ配下のイベントを地図へバブリングさせない
  const stopAll = (e: React.SyntheticEvent) => e.stopPropagation();

  const handleClear = () => {
    setQ("");
    setItems([]);
    setOpen(false);
    inputRef.current?.focus();
  };

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
      {/* 入力ボックス：左に×、右に🔍。相応にパディング調整 */}
      <div style={{ position: "relative" }}>
        {/* 左×（入力がある時のみ表示） */}
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
          className="tm-search-input"
          type="search"
          inputMode="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => list.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            } else if (e.key === "Escape") {
              // Escで候補閉じる/入力クリア
              if (open) setOpen(false);
              else handleClear();
            }
          }}
          placeholder="場所を検索（例：広島、尾道、厳島神社）"
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "rgba(255,255,255,0.95)",
            padding: "10px 40px 10px 34px", // 左×と右🔍のために左右を広めに
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          }}
        />

        {/* 右🔍 */}
        <button
          type="button"
          aria-label="検索"
          onClick={runSearch}
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
              // マウス押下の時点で確定（フォーカス移動で閉じる前に処理）
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
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




