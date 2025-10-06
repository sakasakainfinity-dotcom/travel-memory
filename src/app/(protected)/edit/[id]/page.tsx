"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function EditPlacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const placeId = id as string;

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [visitedAt, setVisitedAt] = useState<string>(new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // place
      const { data: p } = await supabase.from("places").select("*").eq("id", placeId).single();
      if (p) { setTitle(p.title ?? ""); setAddress(p.address ?? ""); }
      // latest memory
      const { data: ms } = await supabase
        .from("memories").select("*").eq("place_id", placeId)
        .order("created_at", { ascending: false }).limit(1);
      const m = ms?.[0];
      if (m) { setNote(m.note ?? ""); setVisitedAt(m.visited_at ?? visitedAt); }
      setLoading(false);
    })();
  }, [placeId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // 更新
    await supabase.from("places").update({ title: title || null, address: address || null }).eq("id", placeId);
    const { data: ms } = await supabase
      .from("memories").select("id").eq("place_id", placeId).order("created_at", { ascending: false }).limit(1);
    if (ms && ms[0]) {
      await supabase.from("memories").update({
        visited_at: visitedAt || new Date().toISOString().slice(0,10),
        note: note || null,
      }).eq("id", ms[0].id);
    } else {
      // 無ければ新規
      await supabase.from("memories").insert({
        space_id: null, // RLSの都合で必要なら埋める（space_id は既存のレコードから拾うのが理想）
        place_id: placeId,
        visited_at: visitedAt || new Date().toISOString().slice(0,10),
        note: note || null,
      });
    }
    setLoading(false);
    router.replace("/");   // ← 編集完了後は自動で地図へ戻る
  }

  if (loading) return <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ margin: "8px 0 16px 0" }}>投稿を編集</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <label>タイトル</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>住所</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
        <label>訪問日</label>
        <input type="date" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} />
        <label>メモ</label>
        <textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="submit" disabled={loading} style={{ background: "#111", color: "#fff", border: "none", padding: "10px 14px", borderRadius: 8 }}>
            保存して地図へ戻る
          </button>
          <button type="button" onClick={() => router.replace("/")} style={{ border: "1px solid #ddd", padding: "10px 14px", borderRadius: 8 }}>
            変更せず戻る
          </button>
        </div>
      </form>
    </main>
  );
}
