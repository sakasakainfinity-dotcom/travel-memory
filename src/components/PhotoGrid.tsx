// src/components/PhotoGrid.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import type { Photo as DBPhoto } from "@/types/db";
import { canPreviewInImg } from "@/lib/mime";

type Props = { photos: DBPhoto[] };

// 文字列がURLかどうか（雑に判定）
const isHttpUrl = (s?: string | null) => !!s && /^https?:\/\//i.test(s);

// Supabaseのサイン付きURLを作る
async function signFromMemories(path?: string | null, expiresSec = 3600) {
  if (!path) return undefined;
  // すでに公開URLならそのまま返す
  if (isHttpUrl(path)) return path;
  const { data, error } = await supabase
    .storage
    .from("memories") // ←★バケット名。違うなら直す
    .createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

/**
 * DBのスキーマ差異を吸収：
 * - 新スキーマ: original_url / thumb_url / content_type / storage_path系
 * - 旧スキーマ: file_url / url / storage_path
 */
function formatTakenAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function buildPhotoMetaLines(photo: DBPhoto) {
  const lines: string[] = [];
  const camera = [photo.camera_make, photo.camera_model].filter(Boolean).join(" ").trim();
  if (camera) lines.push(`機材: ${camera}`);
  if (photo.lens_model) lines.push(`レンズ: ${photo.lens_model}`);

  const exposureBits = [
    typeof photo.focal_length === "number" ? `${photo.focal_length}mm` : null,
    typeof photo.f_number === "number" ? `F${photo.f_number}` : null,
    photo.exposure_time ? `${photo.exposure_time}s` : null,
    typeof photo.iso === "number" ? `ISO ${photo.iso}` : null,
  ].filter(Boolean);
  if (exposureBits.length > 0) lines.push(exposureBits.join(" / "));

  const takenAt = formatTakenAt(photo.taken_at);
  if (takenAt) lines.push(`撮影日時: ${takenAt}`);

  if (typeof photo.gps_lat === "number" && typeof photo.gps_lng === "number") {
    lines.push(`位置情報: ${photo.gps_lat.toFixed(6)}, ${photo.gps_lng.toFixed(6)}`);
  }

  if (typeof photo.orientation === "number") {
    lines.push(`Orientation: ${photo.orientation}`);
  }

  return lines;
}

function resolvePaths(p: any) {
  // 原本パス（優先度: storage_path or original_url or file_url or url）
  const original =
    p.storage_path ||
    p.original_url ||
    p.file_url ||
    p.url ||
    null;

  // サムネパス（優先度: thumb_storage_path or thumb_url）
  const thumb =
    p.thumb_storage_path ||
    p.thumb_url ||
    null;

  const contentType: string | undefined =
    p.content_type ||
    p.mime ||
    p.type ||
    undefined;

  return { original, thumb, contentType };
}

export default function PhotoGrid({ photos }: Props) {
  const [signed, setSigned] = useState<
    Record<string, { original?: string; thumb?: string; contentType?: string }>
  >({});

  useEffect(() => {
    let aborted = false;

    (async () => {
      const out: Record<string, { original?: string; thumb?: string; contentType?: string }> = {};
      for (const p of photos) {
        const { original, thumb, contentType } = resolvePaths(p);

        // 署名 or そのまま
        const [origUrl, thumbUrl] = await Promise.all([
          isHttpUrl(original) ? original : signFromMemories(original),
          isHttpUrl(thumb) ? thumb : signFromMemories(thumb),
        ]);

        out[p.id] = { original: origUrl, thumb: thumbUrl, contentType };
      }
      if (!aborted) setSigned(out);
    })();

    return () => { aborted = true; };
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
        const s = signed[p.id] || {};
        const previewUrl =
          s.thumb ||
          (s.original && s.contentType && canPreviewInImg(s.contentType) ? s.original : undefined);
        const metaLines = buildPhotoMetaLines(p);

        return (
          <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative", width: "100%", paddingBottom: "66%" }}>
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  style={{ objectFit: "cover", borderRadius: 8 }}
                />
              ) : s.original ? (
                // プレビューできない形式（例: HEIC, RAW）。DL導線だけ出す
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 8,
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 6,
                    padding: 8,
                    textAlign: "center",
                    color: "#374151",
                    fontSize: 12,
                  }}
                >
                  <strong>この形式はプレビュー非対応です</strong>
                  <span>このファイル形式のダウンロード機能は提供を終了しました。</span>
                </div>
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

            {metaLines.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "8px 10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                  fontSize: 12,
                  color: "#374151",
                  lineHeight: 1.45,
                }}
              >
                {metaLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
