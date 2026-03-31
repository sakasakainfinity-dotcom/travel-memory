"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ensureMySpace } from "@/lib/ensureMySpace";

type ListRow = {
  id: string;
  title: string | null;
  memo: string | null;
  ai_summary: string | null;
  status: "wishlist" | "visited";
  lat: number;
  lng: number;
  created_at: string;
  photos: string[];
};

export default function WishlistListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ListRow[]>([]);
  const [tab, setTab] = useState<"wishlist" | "visited">("wishlist");

  useEffect(() => {
    (async () => {
      const mySpace = await ensureMySpace();
      if (!mySpace?.id) return;

      const { data: places, error } = await supabase
        .from("places")
        .select("id,title,memo,ai_summary,status,lat,lng,created_at")
        .eq("space_id", mySpace.id)
        .eq("visibility", "private")
        .in("status", ["wishlist", "visited"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (places ?? []).map((p: any) => p.id);
      const photosBy: Record<string, string[]> = {};
      if (ids.length > 0) {
        const { data: phs } = await supabase.from("photos").select("place_id,file_url").in("place_id", ids);
        for (const ph of phs ?? []) {
          const pid = (ph as any).place_id as string;
          const url = (ph as any).file_url as string;
          (photosBy[pid] ||= []).push(url);
        }
      }

      setRows(
        ((places ?? []) as any[]).map((p) => ({
          ...p,
          status: (p.status ?? ((photosBy[p.id] ?? []).length > 0 ? "visited" : "wishlist")) as "wishlist" | "visited",
          photos: photosBy[p.id] ?? [],
        }))
      );
    })().catch((e) => {
      console.error(e);
      alert("一覧の読み込みに失敗しました");
    });
  }, []);

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "18px 14px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>行きたい場所リスト</h1>
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 14 }}>
        <button onClick={() => setTab("wishlist")} style={chip(tab === "wishlist")}>⭐ 行きたい</button>
        <button onClick={() => setTab("visited")} style={chip(tab === "visited")}>📷 行った</button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {filtered.map((r) => (
          <article key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, display: "grid", gridTemplateColumns: "84px 1fr", gap: 10 }}>
            <div style={{ width: 84, height: 84, borderRadius: 8, overflow: "hidden", background: "#f3f4f6", display: "grid", placeItems: "center" }}>
              {r.photos[0] ? <img src={r.photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>{r.status === "wishlist" ? "⭐" : "📷"}</span>}
            </div>
            <div>
              <div style={{ fontWeight: 800 }}>{r.title || "無題"}</div>
              <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>{r.ai_summary || r.memo || "（メモなし）"}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12 }}>{r.status === "wishlist" ? "⭐ wishlist" : "📷 visited"}</span>
                <button
                  style={{ border: "1px solid #d1d5db", borderRadius: 999, padding: "6px 10px", background: "#fff", cursor: "pointer" }}
                  onClick={() => router.push(`/?focus=${r.id}&open=1&lat=${r.lat}&lng=${r.lng}`)}
                >
                  地図へ飛ぶ
                </button>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && <div style={{ color: "#6b7280" }}>まだありません。</div>}
      </div>
    </main>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #111827" : "1px solid #d1d5db",
    background: active ? "#111827" : "#fff",
    color: active ? "#fff" : "#111827",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
    cursor: "pointer",
  };
}
