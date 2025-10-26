// src/lib/image.ts
// 画像アップロード＆圧縮ユーティリティ（ブラウザ安全設計）

import { createClient } from "@supabase/supabase-js";

// Supabase クライアント（公開キーでOK）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Storage へアップロードする前に、
 * - HEIC/HEIF は JPEG へ変換（端末差潰しの二重ガード）
 * - contentType は変換後のものを渡す
 */
export async function uploadToStorage(raw: File) {
  // convertToUploadableImage はブラウザ前提のため、動的 import に統一
  const { convertToUploadableImage } = await import("./convertToUploadableImage");
  const f = await convertToUploadableImage(raw);

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
 * 画像を「HEICならJPEGへ変換 → 必要なら縮小 → JPEG出力」する。
 * ブラウザ専用（SSR/ビルド時は安全に素通し）。
 */
export async function compress(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxSide = 2048, quality = 0.9 } = opts;

  // まず HEIC/HEIF を JPEG に揃える（※動的 import）
  const { convertToUploadableImage } = await import("./convertToUploadableImage");
  let f = await convertToUploadableImage(file);

  // SSR/ビルド時はここで返す（window, canvas が無い）
  if (typeof window === "undefined") return f;

  // 画像サイズを見て、必要なら縮小（createImageBitmap 優先）
  try {
    const bitmap = await createImageBitmap(f);
    const max = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxSide / max);
    if (scale >= 1) return f; // 縮小不要

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const blob = await drawToJpegBlob(bitmap, w, h, quality);

    return new File([blob], ensureJpegName(f.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // createImageBitmap 非対応などのフォールバック（<img> 経由）
    try {
      const blob = await drawViaImageElement(f, maxSide, quality);
      return new File([blob], ensureJpegName(f.name), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } catch {
      // 縮小できなくても、変換済みだけ返す（安全優先）
      return f;
    }
  }
}

/* -------------------- 小さなヘルパー群 -------------------- */

function ensureJpegName(name: string) {
  const base = name?.replace(/\.\w+$/, "") || "image";
  return `${base}.jpg`;
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality
    );
  });
}

async function drawToJpegBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = drawToCanvas(bitmap, width, height);
  return await canvasToJpegBlob(canvas, quality);
}

async function drawViaImageElement(
  file: File,
  maxSide: number,
  quality: number
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const max = Math.max(img.width, img.height);
    const scale = Math.min(1, maxSide / max);
    if (scale >= 1) {
      // 縮小不要でも JPEG で吐き直す（互換性のため）
      const canvas = drawToCanvas(img, img.width, img.height);
      return await canvasToJpegBlob(canvas, quality);
    }
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = drawToCanvas(img, w, h);
    return await canvasToJpegBlob(canvas, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}





