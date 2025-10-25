export async function compress(file: File, maxW = 1600, quality = 0.8): Promise<Blob> {
  // HEIC/HEIF対応：iPhoneのファイルをJPEGに変換
  const type = file.type.includes("heic") || file.type.includes("heif") ? "image/jpeg" : file.type;

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    // HEICでcreateImageBitmapが失敗する場合 → 一旦blobURL経由でHTMLImageElementで読み込み
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxW / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
  }

  const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return (await canvas.convertToBlob({ type, quality })) as Blob;
}


