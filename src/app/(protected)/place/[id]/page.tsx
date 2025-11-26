// src/app/(protected)/place/[id]/page.tsx
"use client";

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

  useEffect(() => {
    if (!placeId) return;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data: p, error } = await supabase
          .from("places")
          .select("*")
          .eq("id", placeId)
          .single();

        if (error) throw error;
        setPlace(p as Place);

        // 写真一覧
        const { data: ph } = await supabase
          .from("photos")
          .select("*")
          .eq("place_id", placeId);
        setPhotos(ph as DBPhoto[]);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [placeId]);

  if (!placeId) return <div>id が無いけぇ読めんよ。</div>;
  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color: "red" }}>{err}</div>;
  if (!place) return <div>この投稿は消されとるよ。</div>;

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{place.title ?? "無題"}</h1>

      <div style={{ color: "#555", marginBottom: 8 }}>
        {place.memo ?? "（メモなし）"}
      </div>

      <div style={{ marginBottom: 8 }}>
        <b>公開範囲：</b>
        {place.visibility === "public"
          ? "公開（青ピン）"
          : place.visibility === "pair"
          ? "ペア限定（黄ピン）"
          : "非公開（赤ピン）"}
      </div>

      <div style={{ fontSize: 12, color: "#777" }}>
        {place.lat}, {place.lng}
      </div>

      <div style={{ marginTop: 16 }}>
        <PhotoGrid photos={photos} />
      </div>
    </main>
  );
}
