// src/app/history/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";
import { useRouter } from "next/navigation";

type Row = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  thumbnail: string | null; // 最初の1枚だけ
};

/** タイトル＋座標（小数4桁 ≈ 11m）で場所キー化 */
function makePlaceKey(title: string | null, lat: number, lng: number) {
  const normTitle = (title ?? "").replace(/\s+/g, "").toLowerCase();
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  return `${normTitle}|${r(lat)}|${r(lng)}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sp = await ensureMySpace();
        if (!sp?.id) {
          setItems([]);
          return;
        }

        // 場所を新しい順で取得
        const { data: ps, error: ePlaces } = await supabase
          .from("places")
          .select("id, title, memo, lat, lng, created_at")
          .eq("space_id", sp.id)
          .order("created_at", { ascending: false });

        if (ePlaces || !ps) {
          console.error(ePlaces);
          setItems([]);
          return;
        }

        // --- 重複まとめ（タイトル＋座標丸め） ---
        const seen = new Set<string>();
        const uniq: any[] = [];
        for (const p of ps) {
          const key = makePlaceKey(p.title, p.lat, p.lng);
          if (seen.has(key)) continue; // 同じ場所はスキップ
          seen.add(key);
          uniq.push(p); // 代表1件だけ残す
        }

        const ids = uniq.map((p) => p.id);

        // 代表placeごとに「最初の1枚」を拾う
        const thumbBy: Record<string, string> = {};
        if (ids.length > 0) {
          const { data: phs, error: ePh } = await supabase
            .from("photos")
            .select("place_id, file_url, created_at")
            .in("place_id", ids)
            .order("created_at", { ascending: true }); // 最古順

          if (!ePh && phs) {
            for (const ph of phs as { place_id: string; file_url: string }[]) {
              if (!thumbBy[ph.place_id]) thumbBy[ph.place_id] = ph.file_url; // 最初の1枚だけ
            }
          } else {
            console.error(ePh);
          }
        }

        setItems(
          uniq.map((p) => ({
            id: p.id,
            title: p.title,
            memo: p.memo,
            lat: p.lat,
            lng: p.lng,
            thumbnail: thumbBy[p.id] ?? null,
          }))
        );
      } catch (err) {
        console.error(err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 16 }}>読み込み中…</div>;

  return (
    <main
      style={{
        padding: 16,
        position: "relative",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>投稿履歴</h1>
      {items.length === 0 && (
        <div style={{ color: "#6b7280" }}>まだ投稿がありません</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))",
          gap: 12,
        }}
      >
        {items.map((it) => (
          <article
            key={it.id}
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {it.thumbnail ? (
              <img
                src={it.thumbnail}
                alt=""
                loading="lazy"
                style={{
                  width: "100%",
                  height: 160,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  height: 160,
                  background: "#f3f4f6",
                  display: "grid",
                  placeItems: "center",
                  color: "#9ca3af",
                }}
              >
                No photo
              </div>
            )}

            <div style={{ padding: 10 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={it.title || "無題"}
              >
                {it.title || "無題"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "#6b7280",
                  height: 40,
                  overflow: "hidden",
                }}
              >
                {it.memo || "（メモなし）"}
              </div>

              {/* 地図で見る（クエリでフォーカス） */}
              <Link
                href={`/?focus=${it.id}&open=1&lat=${it.lat}&lng=${it.lng}`}
                className="inline-flex items-center gap-2"
                aria-label="地図で見る"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 8,
                  fontWeight: 800,
                  textDecoration: "none",
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,.08)",
                  background: "rgba(255,255,255,0.85)",
                  boxShadow: "0 6px 20px rgba(0,0,0,.08)",
                  backdropFilter: "saturate(120%) blur(6px)",
                }}
              >
                地図で見る →
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* 右下フローティング「マップに戻る」ボタン */}
      <button
        type="button"
        onClick={() => router.push("/")}
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          zIndex: 50,
          padding: "12px 18px",
          borderRadius: 9999,
          border: "none",
          background: "rgba(37,99,235,0.95)",
          boxShadow: "0 10px 24px rgba(15,23,42,0.35)",
          fontSize: 14,
          fontWeight: 800,
          color: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ← マップに戻る
      </button>
    </main>
  );
}
