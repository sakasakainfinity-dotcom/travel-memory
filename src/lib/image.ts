import { convertToUploadableImage } from "./convertToUploadableImage";

export type CompressOptions = {
  maxSide?: number;
  quality?: number;
  targetMaxBytes?: number;
};

const DEFAULT_MAX_SIDE = 1280;
const DEFAULT_QUALITY = 0.68;
const DEFAULT_TARGET_MAX_BYTES = 350 * 1024;
const MIN_QUALITY = 0.4;
const MIN_MAX_SIDE = 720;

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const { maxSide = DEFAULT_MAX_SIDE, quality = DEFAULT_QUALITY, targetMaxBytes } = opts;
  const normalized = await convertToUploadableImage(file);

  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;

  try {
    try {
      bitmap = await createImageBitmap(normalized);
    } catch {
      objectUrl = URL.createObjectURL(normalized);
      const img = await loadImage(objectUrl);
      bitmap = await createImageBitmap(img);
    }

    const desiredMaxBytes = clampTargetBytes(targetMaxBytes ?? Math.floor(normalized.size * 0.1));
    const sideCandidates = buildSideCandidates(maxSide);
    const qualityCandidates = buildQualityCandidates(quality);

    let bestBlob: Blob | null = null;

    for (const side of sideCandidates) {
      const [width, height] = fitWithin(bitmap.width, bitmap.height, side);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context unavailable");

      ctx.drawImage(bitmap, 0, 0, width, height);

      for (const candidateQuality of qualityCandidates) {
        const blob = await canvasToBestFormat(canvas, candidateQuality);

        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob;
        }
        if (blob.size <= desiredMaxBytes) {
          return blob;
        }
      }
    }

    if (bestBlob) return bestBlob;
    throw new Error("image compression failed");
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function compress(file: File, opts?: CompressOptions) {
  return compressImage(file, opts);
}

function fitWithin(width: number, height: number, maxSide: number): [number, number] {
  if (!width || !height) return [maxSide, maxSide];
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function canvasToBestFormat(canvas: HTMLCanvasElement, quality: number) {
  try {
    return await canvasToBlob(canvas, "image/webp", quality);
  } catch {
    return canvasToBlob(canvas, "image/jpeg", quality);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error(`toBlob failed for ${type}`));
      },
      type,
      quality
    );
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = src;
  });
}

function clampTargetBytes(bytes: number) {
  return Math.min(DEFAULT_TARGET_MAX_BYTES, Math.max(120 * 1024, bytes));
}

function buildSideCandidates(maxSide: number) {
  return uniqueDescending([
    maxSide,
    Math.round(maxSide * 0.85),
    Math.round(maxSide * 0.72),
    Math.round(maxSide * 0.6),
    Math.max(MIN_MAX_SIDE, Math.round(maxSide * 0.5)),
    MIN_MAX_SIDE,
  ].filter((side) => side >= MIN_MAX_SIDE));
}

function buildQualityCandidates(quality: number) {
  return uniqueDescending([
    quality,
    quality - 0.03,
    quality - 0.12,
    quality - 0.2,
    quality - 0.28,
    quality - 0.36,
    MIN_QUALITY,
  ].map((value) => Number(Math.min(0.92, Math.max(MIN_QUALITY, value)).toFixed(2))));
}

function uniqueDescending(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => b - a);
}
