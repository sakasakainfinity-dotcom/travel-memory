// src/lib/thumbnail.ts
import { inferMimeFromName } from "./mime";

export type ThumbOptions = { maxSide?: number; quality?: number };

export async function generateThumbnail(file: File, opts: ThumbOptions = {}): Promise<File | null> {
  const { maxSide = 1280, quality = 0.8 } = opts;
  const name = file.name || "image";

  // RAW系はスキップ（必要なら対応拡張）
  if (/(dng|tif|tiff)$/i.test(name) || /image\/tiff/i.test(file.type)) return null;

  const isHeic =
    /image\/hei[cf]/i.test(file.type) ||
    /\.(hei[cf])$/i.test(name) ||
    (await looksLikeHeicByMagic(file));

  let base: Blob | File = file;

  // HEICはheic2any → 失敗してもサムネだけ諦める（原本保存は続行）
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default as any;
      base = (await heic2any({ blob: file, toType: "image/jpeg", quality })) as Blob;
    } catch { return null; }
  }

  // bitmap経由（失敗したら<img>フォールバック）
  try {
    const bitmap = await createImageBitmap(base);
    const [w, h] = fit(bitmap.width, bitmap.height, maxSide);
    const blob = await drawToJpegBlob(bitmap, w, h, quality);
    return new File([blob], ensureJpegName(name, "-thumb"), { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    try {
      const url = URL.createObjectURL(base);
      const img = await loadImage(url); URL.revokeObjectURL(url);
      const [w, h] = fit(img.width, img.height, maxSide);
      const blob = await drawToJpegBlob(img, w, h, quality);
      return new File([blob], ensureJpegName(name, "-thumb"), { type: "image/jpeg", lastModified: Date.now() });
    } catch { return null; }
  }
}

/* helpers */
function fit(w: number, h: number, maxSide: number): [number, number] {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return [Math.round(w * scale), Math.round(h * scale)];
}
function ensureJpegName(name: string, suffix = "") { return (name.replace(/\.\w+$/, "") || "image") + `${suffix}.jpg`; }
function drawToJpegBlob(src: CanvasImageSource, w: number, h: number, q: number): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!; ctx.drawImage(src, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob failed")), "image/jpeg", q));
}
function loadImage(url: string) { return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
async function looksLikeHeicByMagic(file: File) {
  try { const head = new Uint8Array(await file.slice(0, 32).arrayBuffer()); const a = new TextDecoder().decode(head);
    return a.includes("ftypheic") || a.includes("ftypheif") || a.includes("ftyphevc");
  } catch { return false; }
}
