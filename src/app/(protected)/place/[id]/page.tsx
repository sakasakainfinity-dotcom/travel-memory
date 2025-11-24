"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PhotoGrid from "@/components/PhotoGrid";
import type { Place, Photo as DBPhoto } from "@/types/db"; // ← ここPOINT

export default function PlaceDetailPage() {
  const params = useParams() as { id?: string | string[] };
  const placeId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [place, setPlace] = useState<Place | null>(null);
  const [photos, setPhotos] = useState<DBPhoto[]>([]); // ← DBのPhoto型に統一
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const { data: place } = await supabase
　　　　  .from("places")
　　　　  .select("id, title, lat, lng, address, visibility") // ★ visibility を含める
　　　　  .eq("id", id)
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
        // まず place の memories を取得
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

        // PhotoGrid が期待しているのは url / storage_path / place_id を持つDB型
        const { data: ph2, error: ep } = await supabase
          .from("photos")
          .select("id,url,storage_path,place_id,created_at,memory_id") // ← ここPOINT
          .in("memory_id", ids)
          .order("created_at", { ascending: false });
        if (ep) throw ep;

        // 余計なフィールドは無視して、必要最低限をDB型に合わせて詰める
        const normalized: DBPhoto[] = (ph2 ?? []).map((p: any) => ({
          id: p.id,
          url: p.url,
          storage_path: p.storage_path,
          place_id: p.place_id,
          created_at: p.created_at,
          // types/db に他の必須があればここで追加
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
        <p><Link href="/">← 戻る</Link></p>
      </main>
    );
  }

  if (!place) {
    return (
      <main style={{ padding: 16 }}>
        <p>この場所は見つからんかったよ。</p>
        <p><Link href="/">← 戻る</Link></p>
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
        {`(${Number((place as any).lat).toFixed(4)}, ${Number((place as any).lng).toFixed(4)})`}
      </div>

      <PhotoGrid photos={photos} />
    </main>
  );
}
