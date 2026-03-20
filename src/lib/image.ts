import { convertToUploadableImage } from "./convertToUploadableImage";

export type CompressOptions = {
  maxSide?: number;
  quality?: number;
};

const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_QUALITY = 0.8;

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<Blob> {
  const { maxSide = DEFAULT_MAX_SIDE, quality = DEFAULT_QUALITY } = opts;
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

    const [width, height] = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context unavailable");

    ctx.drawImage(bitmap, 0, 0, width, height);

    try {
      return await canvasToBlob(canvas, "image/webp", quality);
    } catch {
      return await canvasToBlob(canvas, "image/jpeg", quality);
    }
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
