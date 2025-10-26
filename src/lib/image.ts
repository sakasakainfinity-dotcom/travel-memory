// src/lib/image.ts （例）
import { convertToUploadableImage } from "./convertToUploadableImage";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadToStorage(raw: File) {
  // ★ 二重ガード
  const f = await convertToUploadableImage(raw);

  // 画面に出すログが欲しければ、呼び出し側で表示
  const path = `photos/${crypto.randomUUID()}-${f.name}`;
  const { data, error } = await supabase.storage.from("photos").upload(path, f, {
    contentType: f.type, // ← "image/jpeg" になってるはず
    upsert: false,
  });

  if (error) throw error;
  return data;
}

export type CompressOptions = {
  /** 長辺の最大px（既定 2048） */
  maxSide?: number;
  /** JPEG圧縮品質 0..1（既定 0.9） */
  quality?: number;
};

/**
 * 画像を「HEICならJPEGへ変換 → 必要なら縮小 → JPEG出力」するユーティリティ。
 * ブラウザ専用（SSRではそのまま返す）にして安全側に倒しとる。
 */
export async function compress(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxSide = 2048, quality = 0.9 } = opts;

  // まず HEIC/HEIF を JPEG に揃える（convertToUploadableImage はクライアント専用想定）
  const { convertToUploadableImage } = await import("./convertToUploadableImage");
  let f = await convertToUploadableImage(file);

  // SSR安全装置：サーバ側/ビルド時はここで返す（windowが無い）
  if (typeof window === "undefined") return f;

  // 画像サイズを見て、必要なら縮小
  try {
    const bitmap = await createImageBitmap(f);
    const max = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxSide / max);
    if (scale >= 1) return f; // 縮小不要

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality);
    });

    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // 縮小に失敗したら、変換だけで返す（安全優先）
    return f;
  }
}




