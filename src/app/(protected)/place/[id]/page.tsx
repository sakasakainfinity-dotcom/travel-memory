// src/app/(protected)/place/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PhotoGrid from "@/components/PhotoGrid";
import type { Place, Photo as DBPhoto } from "@/types/db";

export default function PlaceDetailPage() {
  const params = useParams() as { id?: string | string[] };
  const placeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [place, setPlace] = useState<Place | null>(null);
  const [photos, setPhotos] = useState<DBPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // place 本体を取得（visibility 含める）
  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("places")
          .select("*") // Place型に必要なカラム全部
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

  // place に紐づく memories → photos
  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        const { data: ms, error: em } = await supabase
          .from("memories")
          .select("id")
          .eq("place_id", placeId);

        if (em) throw em;

        if (!ms || ms.length === 0) {
          setPhotos([]);
          return;
        }

        const ids = ms.map((m) => m.id);

        const { data: ph2, error: ep } = await supabase
          .from("photos")
          .select("id, url, storage_path, place_id, created_at, memory_id")
          .in("memory_id", ids)
          .order("created_at", { ascending: false });

        if (ep) throw ep;

        const normalized: DBPhoto[] = (ph2 ?? []).map((p: any) => ({
          id: p.id,
          url: p.url,
          storage_path: p.storage_path,
          place_id: p.place_id,
          created_at: p.created_at,
        }));

        setPhotos(normalized);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [placeId]);

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Link href="/">← 戻る</Link>
        <h1 style={{ margin: 0 }}>{place.title ?? "無題の場所"}</h1>
      </div>

      <div style={{ color: "#666" }}>
        {`(${Number((place as any).lat).toFixed(4)}, ${Number(
          (place as any).lng
        ).toFixed(4)})`}
      </div>

      <div style={{ color: "#6b7280", fontSize: 12 }}>
        公開状態:{" "}
        {place.visibility === "public"
          ? "公開（全国だれでも）"
          : place.visibility === "pair"
          ? "ペア限定"
          : "非公開（自分だけ）"}
      </div>

      {/* 写真一覧 */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>写真</h2>
        <PhotoGrid photos={photos} />
      </section>

      {/* 思い出を追加（MemoryForm） */}
      <section>
        <h2 style={{ fontSize: 16, margin: "16px 0 8px" }}>思い出を追加</h2>
        <MemoryForm spaceId={place.space_id} placeId={place.id} />
      </section>
    </main>
  );
}


