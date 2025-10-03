"use client";
import type { Photo } from "@/types/db";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PhotoGrid({ photos }: { photos: Photo[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage
          .from("memories")
          .createSignedUrl(p.file_url, 60 * 60);
        if (data?.signedUrl) out[p.id] = data.signedUrl;
      }
      setUrls(out);
    })();
  }, [photos]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
      {photos.map((p) => (
        <img
          key={p.id}
          src={urls[p.id]}
          alt=""
          style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8 }}
        />
      ))}
    </div>
  );
}
