// src/components/SearchBox.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type LocalPlace = {
  id: string;
  name?: string | null;
  memo?: string | null;
  lat: number;
  lng: number;
};

type RemotePlace = {
  name: string;
  address?: string;
  lat: number;
  lng: number;
};

type Props = {
  places: LocalPlace[]; // 投稿（ローカル）
  onPickPost: (p: { id: string; lat: number; lng: number; zoom?: number }) => void;
  onPickLocation: (p: { name: string; address?: string; lat: number; lng: number; zoom?: number }) => void;
};

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchBox({ places, onPickPost, onPickLocation }: Props) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);

  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<RemotePlace[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  // 投稿（ローカル）検索
  const postResults = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return places
      .filter((p) => {
        const name = (p.name ?? "").toLowerCase();
        const memo = (p.memo ?? "").toLowerCase();
        return name.includes(query) || memo.includes(query);
      })
      .slice(0, 10);
  }, [q, places]);

  // 場所（リモート）検索
  useEffect(() => {
    const query = dq.trim();
    if (!query) {
      setRemote([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setRemoteLoading(true);
        const res = await fetch(`/api/place-search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`place-search failed: ${res.status}`);
        const json = await res.json();
        const items = (json?.items ?? json ?? []) as any[];

        const normalized: RemotePlace[] = items
          .map((x) => ({
            name: x.name ?? x.title ?? "",
            address: x.address ?? x.subTitle ?? x.description ?? "",
            lat: Number(x.lat),
            lng: Number(x.lng),
          }))
          .filter((x) => x.name && Number.isFinite(x.lat) && Number.isFinite(x.lng))
          .slice(0, 10);

        if (!cancelled) setRemote(normalized);
      } catch {
        if (!cancelled) setRemote([]);
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dq]);

  const pickPost = (p: LocalPlace) => {
    setOpen(false);
    setQ(p.name ?? "");
    onPickPost({ id: p.id, lat: p.lat, lng: p.lng, zoom: 15 });
  };

  const pickLocation = (p: RemotePlace) => {
    setOpen(false);
    setQ(p.name);
    onPickLocation({ name: p.name, address: p.address, lat: p.lat, lng: p.lng, zoom: 16 });
  };

  const hasAny = postResults.length > 0 || remote.length > 0 || remoteLoading;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "100%" }}>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            e.preventDefault();
            // 優先：投稿 -> 場所
            if (postResults[0]) pickPost(postResults[0]);
            else if (remote[0]) pickLocation(remote[0]);
          }
        }}
        placeholder="投稿 or 場所を検索（タイトル・メモ・地名）"
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "rgba(255,255,255,0.95)",
          padding: "8px 10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          fontSize: 16,
        }}
      />

      {open && hasAny && (
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
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {/* 投稿 */}
          {postResults.length > 0 && (
            <>
              <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 800, color: "#6b7280", background: "#f9fafb" }}>
                投稿
              </div>
              {postResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPost(p)}
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
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name || "無題の投稿"}</div>
                  {p.memo && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.memo}
                    </div>
                  )}
                </button>
              ))}
            </>
          )}

          {/* 場所 */}
          <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 800, color: "#6b7280", background: "#f9fafb" }}>
            場所 {remoteLoading ? "（検索中…）" : ""}
          </div>

          {remote.map((p, idx) => (
            <button
              key={`${p.name}-${p.lat}-${p.lng}-${idx}`}
              type="button"
              onClick={() => pickLocation(p)}
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
              <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
              {p.address && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{p.address}</div>}
            </button>
          ))}

          {!remoteLoading && remote.length === 0 && (
            <div style={{ padding: "10px", fontSize: 12, color: "#9ca3af" }}>場所は見つからんかった</div>
          )}
        </div>
      )}
    </div>
  );
}

