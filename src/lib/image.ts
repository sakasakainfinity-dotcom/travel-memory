// src/lib/image.ts
import { createClient } from "@supabase/supabase-js";
import { decideContentType } from "./mime";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadOriginal(raw: File) {
  const contentType = await decideContentType(raw);
  const safeName = raw.name || "upload";
  const path = `photos/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage.from("memories").upload(path, raw, {
    contentType, upsert: false,
  });
  if (error) throw error;
  return { path, contentType, data };
}

export async function uploadThumbnail(thumb: File, originalPath: string) {
  const dot = originalPath.lastIndexOf(".");
  const base = dot > -1 ? originalPath.slice(0, dot) : originalPath;
  const thumbPath = `${base}-thumb.jpg`;
  const { data, error } = await supabase.storage.from("memories").upload(thumbPath, thumb, {
    contentType: "image/jpeg", upsert: false,
  });
  if (error) throw error;
  return { path: thumbPath, data };
}

export async function uploadWithOptionalThumb(raw: File, thumb: File | null) {
  const orig = await uploadOriginal(raw);
  let th: { path: string } | null = null;
  if (thumb) {
    try { const t = await uploadThumbnail(thumb, orig.path); th = { path: t.path }; } catch { th = null; }
  }
  return { original: orig, thumbnail: th };
}

/* 互換ダミー（古い import { compress } を殺さないため） */
export type CompressOptions = { maxSide?: number; quality?: number };
export async function compress(file: File, _opts?: CompressOptions) { return file; }


