// src/app/(protected)/edit/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MemoryForm from "@/components/MemoryForm";
import type { Place } from "@/types/db";

export default function EditPlacePage() {
  const params = useParams() as { id?: string | string[] };
  const placeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // place を1件取得（visibility 含めて全部）
        const { data, error } = await supabase
          .from("places")
          .select("*")
          .eq("id", placeId)
          .single();

        if (error) throw error;
        setPlace(data as Place);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [placeId]);

  if (!placeId) {
    return (
      <main style={{ padding: 16 }}>
        <p>URL に id がないみたいじゃ。</p>
        <p>
          <Link href="/">← 戻る</Link>
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div>Loading…</div>
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ padding: 16 }}>
        <p style={{ color: "crimson" }}>{err}</p>
        <p>
          <Link href="/">← 戻る</Link>
        </p>
      </main>
    );
  }

  if (!place) {
    return (
      <main style={{ padding: 16 }}>
        <p>この場所は見つからんかったよ。</p>
        <p>
          <Link href="/">← 戻る</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ border: "none", background: "transparent", cursor: "pointer" }}
        >
          ← 戻る
        </button>
        <h1 style={{ margin: 0 }}>投稿を追加 / 編集</h1>
      </div>

      <div
        style={{
          padding: 8,
          borderRadius: 8,
          background: "#f3f4f6",
          fontSize: 14,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          場所: {place.title ?? "無題の場所"}
        </div>
        <div style={{ color: "#6b7280" }}>
          {`(${Number((place as any).lat).toFixed(4)}, ${Number(
            (place as any).lng
          ).toFixed(4)})`}
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
          現在の公開範囲:{" "}
          {place.visibility === "public"
            ? "公開（全国だれでも）"
            : place.visibility === "pair"
            ? "ペア限定"
            : "非公開（自分だけ）"}
        </div>
      </div>

      {/* ★ここで MemoryForm を使う：spaceId & placeId を渡す */}
      <MemoryForm spaceId={place.space_id} placeId={place.id} />
    </main>
  );
}
