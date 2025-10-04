"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type { Photo as DBPhoto } from "@/types/db";

type Props = {
  photos: DBPhoto[];
};

export default function PhotoGrid({ photos }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let aborted = false;

    (async () => {
      const out: Record<string, string> = {};

      for (const p of photos) {
        // ① storage_path がある → 署名URLを発行
        if (p.storage_path) {
          const { data, error } = await supabase.storage
            .from("memories") // ← バケット名。違うならここ直す
            .createSignedUrl(p.storage_path, 60 * 60); // 1時間

          if (!error && data?.signedUrl) {
            out[p.id] = data.signedUrl;
            continue;
          }
        }

        // ② 署名に失敗 or storage_path が無い → url をそのまま使う（公開URL想定）
        if (p.url) {
          out[p.id] = p.url;
        }
      }

      if (!aborted) setUrls(out);
    })();

    return () => {
      aborted = true;
    };
  }, [photos]);

  if (!photos?.length) {
    return <p style={{ color: "#666" }}>写真はまだ無いみたい。</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 8,
      }}
    >
      {photos.map((p) => {
        const src = urls[p.id];
        return (
          <div key={p.id} style={{ position: "relative", width: "100%", paddingBottom: "66%" }}>
            {src ? (
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 768px) 50vw, 20vw"
                style={{ objectFit: "cover", borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "#eee",
                  borderRadius: 8,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}


