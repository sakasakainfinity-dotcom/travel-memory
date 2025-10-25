// src/lib/image.ts
// HEIC / HDR でも落ちない安全版 compress()

export async function compress(file: File, maxW = 1600, quality = 0.8): Promise<Blob> {
  // まず createImageBitmap() を試す
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bmp.width * scale)),
      Math.max(1, Math.round(bmp.height * scale))
    );
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    bmp.close?.();
    return blob;
  } catch (err) {
    console.warn("⚠️ createImageBitmap 失敗:", err);
  }

  // fallback: FileReader + <img> 経由
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onerror = () => rej(fr.error);
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
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
  } catch (err) {
    console.error("❌ fallback でも失敗:", err);
    throw err;
  }
}
