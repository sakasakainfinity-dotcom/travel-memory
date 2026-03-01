"use client";

import { useEffect, useState } from "react";

type Place = {
  id: string;
  lat: number;
  lng: number;
  title: string | null;
  address: string | null;
  memo: string | null;
  created_at: string;
  visibility: "public" | "private" | "pair";
  visited_at: string | null;
  taken_at: string | null;
};

export default function SharePage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" });
        const text = await res.text();
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch {}

        if (!res.ok) throw new Error(json?.error ?? text ?? `fetch failed (${res.status})`);

        setPlaces(json?.places ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div style={{ minHeight: "100svh", background: "#05070c", color: "#f8fafc", padding: 20 }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>共有マップ</h1>
        <p style={{ color: "rgba(226,232,240,0.75)", marginTop: 8, lineHeight: 1.6 }}>
          このURLを知っとる人だけが見れるページです（閲覧のみ）。
        </p>

        {loading && <div style={{ marginTop: 18 }}>読み込み中…</div>}
        {err && (
          <div style={{ marginTop: 18, color: "#fb7185", fontWeight: 800 }}>
            エラー: {err}
          </div>
        )}

        {!loading && !err && (
          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {places.length === 0 ? (
              <div style={{ color: "rgba(226,232,240,0.7)" }}>
                公開（public）の投稿がまだありません。
              </div>
            ) : (
              places.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    padding: 14,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {p.title ?? "（タイトルなし）"}
                  </div>
                  <div style={{ marginTop: 6, color: "rgba(226,232,240,0.75)", fontSize: 12 }}>
                    {p.address ?? ""}
                  </div>
                  {p.memo && (
                    <div style={{ marginTop: 8, color: "rgba(226,232,240,0.86)", lineHeight: 1.6 }}>
                      {p.memo}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: "rgba(226,232,240,0.6)" }}>
                    {new Date(p.created_at).toLocaleString("ja-JP")}
                    {" · "}
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
