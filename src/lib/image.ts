// src/lib/image.ts
// iOS HEIC/HDR/Liveでも落ちない圧縮（Safari/PWA対応）

export async function compress(file: File, maxW = 1600, quality = 0.8): Promise<Blob> {
  // HEIC/HEIFは最終JPEG化
  const forceJPEG =
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  // まず高速ルート
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
    // SafariでもOKなように OffscreenCanvas 非依存へ
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), forceJPEG ? "image/jpeg" : "image/jpeg", quality)
    );
  } catch (e) {
    console.warn("createImageBitmap失敗→fallback:", e);
  }

  // 失敗時：blob URL → <img> 経由で再エンコード（Live/HDR/10bit対策）
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const scale = Math.min(1, maxW / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}



