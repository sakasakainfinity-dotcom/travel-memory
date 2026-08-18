import { convertToUploadableImage } from "./convertToUploadableImage";

export type CompressOptions = {
  maxSide?: number;
  quality?: number;
  targetMaxBytes?: number;
  sizeCapBytes?: number;
  maxRecompressions?: number;
  recompressQualityStep?: number;
  minRecompressQuality?: number;
};

const DEFAULT_MAX_SIDE = 960;
const DEFAULT_QUALITY = 0.55;
const DEFAULT_TARGET_MAX_BYTES = 200 * 1024;
const DEFAULT_SIZE_CAP_BYTES = 350 * 1024;
const DEFAULT_MAX_RECOMPRESSIONS = 3;
const DEFAULT_RECOMPRESS_QUALITY_STEP = 0.1;
const MIN_QUALITY = 0.3;
const MIN_MAX_SIDE = 320;
const SIZE_CAP_SCALE_STEP = 0.85;

type SupportedCanvasMimeType = "image/webp" | "image/jpeg";

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const {
    maxSide = DEFAULT_MAX_SIDE,
    quality = DEFAULT_QUALITY,
    targetMaxBytes,
    sizeCapBytes = DEFAULT_SIZE_CAP_BYTES,
    maxRecompressions = DEFAULT_MAX_RECOMPRESSIONS,
    recompressQualityStep = DEFAULT_RECOMPRESS_QUALITY_STEP,
    minRecompressQuality = MIN_QUALITY,
  } = opts;
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
        const adjustedBlob = await enforceBlobSizeCap(canvas, blob, candidateQuality, {
          sizeCapBytes,
          maxRecompressions,
          recompressQualityStep,
          minRecompressQuality,
        });

        if (!bestBlob || adjustedBlob.size < bestBlob.size) {
          bestBlob = adjustedBlob;
        }
        if (adjustedBlob.size <= desiredMaxBytes) {
          return adjustedBlob;
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

async function enforceBlobSizeCap(
  sourceCanvas: HTMLCanvasElement,
  initialBlob: Blob,
  initialQuality: number,
  opts: Required<Pick<CompressOptions, "sizeCapBytes" | "maxRecompressions" | "recompressQualityStep" | "minRecompressQuality">>
) {
  const { sizeCapBytes, maxRecompressions, recompressQualityStep, minRecompressQuality } = opts;

  if (initialBlob.size <= sizeCapBytes) return initialBlob;

  let bestBlob = initialBlob;
  let currentQuality = initialQuality;
  let workingCanvas = sourceCanvas;
  let currentMaxSide = Math.max(sourceCanvas.width, sourceCanvas.height);

  while (true) {
    const recompressed = await recompressWithinCanvas(workingCanvas, currentQuality, {
      sizeCapBytes,
      maxRecompressions,
      recompressQualityStep,
      minRecompressQuality,
    });

    if (recompressed.bestBlob.size < bestBlob.size) {
      bestBlob = recompressed.bestBlob;
    }
    if (recompressed.bestBlob.size <= sizeCapBytes) {
      return recompressed.bestBlob;
    }

    if (currentMaxSide <= MIN_MAX_SIDE) {
      return bestBlob;
    }

    const nextMaxSide = Math.max(MIN_MAX_SIDE, Math.round(currentMaxSide * SIZE_CAP_SCALE_STEP));
    const [nextWidth, nextHeight] = fitWithin(sourceCanvas.width, sourceCanvas.height, nextMaxSide);

    if (nextWidth === workingCanvas.width && nextHeight === workingCanvas.height) {
      return bestBlob;
    }

    workingCanvas = resizeCanvas(sourceCanvas, nextWidth, nextHeight);
    currentMaxSide = Math.max(nextWidth, nextHeight);
    currentQuality = recompressed.lastQuality;
  }
}

async function recompressWithinCanvas(
  canvas: HTMLCanvasElement,
  initialQuality: number,
  opts: Required<Pick<CompressOptions, "sizeCapBytes" | "maxRecompressions" | "recompressQualityStep" | "minRecompressQuality">>
) {
  const { sizeCapBytes, maxRecompressions, recompressQualityStep, minRecompressQuality } = opts;

  let bestBlob = await canvasToBestFormat(canvas, initialQuality);
  let nextQuality = initialQuality;

  if (bestBlob.size <= sizeCapBytes) {
    return { bestBlob, lastQuality: nextQuality };
  }

  for (let attempt = 0; attempt < maxRecompressions; attempt += 1) {
    const loweredQuality = Number(
      Math.max(minRecompressQuality, nextQuality - recompressQualityStep).toFixed(2)
    );

    if (loweredQuality >= nextQuality) break;

    const candidate = await canvasToBestFormat(canvas, loweredQuality);
    if (candidate.size < bestBlob.size) {
      bestBlob = candidate;
    }
    if (candidate.size <= sizeCapBytes) {
      return { bestBlob: candidate, lastQuality: loweredQuality };
    }

    nextQuality = loweredQuality;
  }

  return { bestBlob, lastQuality: nextQuality };
}

function fitWithin(width: number, height: number, maxSide: number): [number, number] {
  if (!width || !height) return [maxSide, maxSide];
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function canvasToBestFormat(canvas: HTMLCanvasElement, quality: number) {
  const webpBlob = await tryCanvasToBlob(canvas, "image/webp", quality);
  if (webpBlob?.type === "image/webp") {
    return webpBlob;
  }

  const jpegBlob = await tryCanvasToBlob(canvas, "image/jpeg", quality);
  if (jpegBlob?.type === "image/jpeg") {
    return jpegBlob;
  }

  throw new Error("canvas export failed for webp and jpeg");
}

async function tryCanvasToBlob(
  canvas: HTMLCanvasElement,
  type: SupportedCanvasMimeType,
  quality: number
) {
  try {
    return await canvasToBlob(canvas, type, quality);
  } catch {
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: SupportedCanvasMimeType, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`toBlob failed for ${type}`));
          return;
        }
        if (blob.type !== type) {
          reject(new Error(`toBlob returned ${blob.type || "unknown"} instead of ${type}`));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function resizeCanvas(sourceCanvas: HTMLCanvasElement, width: number, height: number) {
  const resizedCanvas = document.createElement("canvas");
  resizedCanvas.width = width;
  resizedCanvas.height = height;

  const ctx = resizedCanvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");

  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  return resizedCanvas;
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
  return Math.min(DEFAULT_TARGET_MAX_BYTES, Math.max(80 * 1024, bytes));
}

function buildSideCandidates(maxSide: number) {
  return uniqueDescending(
    [
      maxSide,
      Math.round(maxSide * 0.85),
      Math.round(maxSide * 0.72),
      Math.round(maxSide * 0.6),
      Math.round(maxSide * 0.5),
      Math.round(maxSide * 0.42),
      Math.round(maxSide * 0.34),
      MIN_MAX_SIDE,
    ].filter((side) => side >= MIN_MAX_SIDE)
  );
}

function buildQualityCandidates(quality: number) {
  return uniqueDescending(
    [quality, quality - 0.03, quality - 0.12, quality - 0.2, quality - 0.28, quality - 0.36, MIN_QUALITY].map(
      (value) => Number(Math.min(0.92, Math.max(MIN_QUALITY, value)).toFixed(2))
    )
  );
}

function uniqueDescending(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => b - a);
}
