"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PhotoGrid from "@/components/PhotoGrid";
import type { Place } from "@/types/db";

type Photo = {
  id: string;
  file_url: string;
  w: number | null;
  h: number | null;
  created_at: string;
};

export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  const placeId = params?.id;
  const [place, setPlace] = useState<Place | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // place 本体
        const { data: p, error: e1 } = await supabase
          .from("places")
          .select("*")
          .eq("id", placeId)
          .single();
        if (e1) throw e1;
        setPlace(p as Place);
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
          .select("id,file_url,w,h,created_at,memory_id")
          .in("memory_id", ids)
          .order("created_at", { ascending: false });
        if (ep) throw ep;

        setPhotos(
          (ph2 ?? []).map((p: any) => ({
            id: p.id,
            file_url: p.file_url,
            w: p.w ?? null,
            h: p.h ?? null,
            created_at: p.created_at,
          }))
        );
      } catch (e: any) {
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
    <main style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Link href="/">← 戻る</Link>
        <h1 style={{ margin: 0 }}>{place.title ?? "無題の場所"}</h1>
      </div>

      <div style={{ color: "#666", marginBottom: 16 }}>
         {((place as any)?.address as string | undefined) ?? `(${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})`}
      <div>
        <PhotoGrid photos={photos} />
      </div>
    </main>
  );
}

