// src/lib/mime.ts
// 原本をそのまま保存するため、アップロード時の contentType を厳密に決める。

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  tiff: "image/tiff",
  tif: "image/tiff",
  dng: "image/x-adobe-dng", // RAWは非対応方針だが、識別はしておく
};

export function inferMimeFromName(name?: string): string | undefined {
  if (!name) return;
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return;
  return EXT_TO_MIME[m[1]];
}

export async function sniffMimeByMagic(file: File): Promise<string | undefined> {
  try {
    const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const ascii = new TextDecoder().decode(buf);
    if (ascii.includes("ftypheic")) return "image/heic";
    if (ascii.includes("ftypheif")) return "image/heif";
    if (ascii.includes("ftyphevc")) return "image/heic";
    if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
    if (buf[0] === 0x89 && ascii.includes("PNG")) return "image/png";
    if (ascii.startsWith("GIF8")) return "image/gif";
    if (ascii.startsWith("RIFF") && ascii.includes("WEBP")) return "image/webp";
  } catch {}
  return;
}

export async function decideContentType(file: File): Promise<string> {
  return (
    file.type ||
    inferMimeFromName(file.name) ||
    (await sniffMimeByMagic(file)) ||
    "application/octet-stream"
  );
}

export function canPreviewInImg(mime: string): boolean {
  return /^(image\/(jpeg|png|webp|gif|avif))$/.test(mime);
}
