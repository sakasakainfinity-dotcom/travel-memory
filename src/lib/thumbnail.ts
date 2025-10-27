// src/lib/thumbnail.ts
// クライアントで「表示用の小さなJPEGサムネイル」を作る。
// 原本は一切変換しない。HEICは heic2any で JPEG にしてから縮小。
// RAW(DNG/TIFFなど)は非対応（nullを返す）。

import { inferMimeFromName } from "./mime";

export type ThumbOptions = {
  maxSide?: number;   // 長辺の最大px（既定 1280）
  quality?: number;   // JPEG品質 0..1（既定 0.8）
};

export async function generateThumbnail(
  file: File,
  opts: ThumbOptions = {}
): Promise<File | null> {
  const { maxSide = 1280, quality = 0.8 } = opts;
  const name = file.name || "image";
  const ext = (inferMimeFromName(name) || "").split("/").pop();

  // RAWは非対応（null返し）
  if (/^(image\/(tiff))$/.test(file.type) || /(dng|tif|tiff)$/i.test(name)) {
    return null;
  }

  // まず表示可能なbitmapを用意（HEICは heic2any で一旦JPEG化）
  let bitmap: ImageBitmap | null = null;
  let baseForCanvas: Blob | File = file;

  const isHeicLike =
    /image\/hei[cf]/i.test(file.type) ||
    /\.(hei[cf])$/i.test(name);

  if (isHeicLike) {
    try {
      const heic2any = (await import("heic2any")).default as any;
      const jpegBlob = (await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality,
      })) as Blob;
      baseForCanvas = jpegBlob;
    } catch {
      // heic2any失敗ならサムネ生成を諦める（原本は保存できる）
      return null;
    }
  }

  try {
    bitmap = await createImageBitmap(baseForCanvas);
  } catch {
    // createImageBitmap 非対応の場合は <img> 経由
    const url = URL.createObjectURL(baseForCanvas);
    try {
      const img = await loadImage(url);
      return await drawToJpegFile(img, name, maxSide, quality);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (!bitmap) return null;

  const max = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxSide / max);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob: Blob = await canvasToJpegBlob(canvas, quality);
  return new File([blob], ensureJpegName(name, "-thumb"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/* ------------ helpers ------------ */

function ensureJpegName(name: string, suffix = ""): string {
  const base = name?.replace(/\.\w+$/, "") || "image";
  return `${base}${suffix}.jpg`;
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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function drawToJpegFile(
  img: HTMLImageElement,
  name: string,
  maxSide: number,
  quality: number
): Promise<File> {
  const max = Math.max(img.width, img.height);
  const scale = Math.min(1, maxSide / max);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await canvasToJpegBlob(canvas, quality);
  return new File([blob], ensureJpegName(name, "-thumb"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
