// src/lib/image.ts
// 方針：原本は非変換で保存＋サムネ(JPEG)だけ一緒に保存。

import { createClient } from "@supabase/supabase-js";
import { decideContentType } from "./mime";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadOriginal(raw: File) {
  const contentType = await decideContentType(raw);
  const safeName = raw.name || "upload";
  const path = `photos/${crypto.randomUUID()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from("photos")
    .upload(path, raw, { contentType, upsert: false });

  if (error) throw error;
  return { path, contentType, data };
}

export async function uploadThumbnail(thumb: File, originalPath: string) {
  const dot = originalPath.lastIndexOf(".");
  const base = dot > -1 ? originalPath.slice(0, dot) : originalPath;
  const thumbPath = `${base}-thumb.jpg`;

  const { data, error } = await supabase.storage
    .from("photos")
    .upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });

  if (error) throw error;
  return { path: thumbPath, data };
}

/** 原本とサムネを“可能なら”同時アップロード。サムネ生成に失敗しても原本は必ず保存。 */
export async function uploadWithOptionalThumb(raw: File, thumb: File | null) {
  const orig = await uploadOriginal(raw);
  let th: { path: string } | null = null;

  if (thumb) {
    try {
      const t = await uploadThumbnail(thumb, orig.path);
      th = { path: t.path };
    } catch {
      // サムネだけ失敗しても原本は残す
      th = null;
    }
  }
  return { original: orig, thumbnail: th };
}




