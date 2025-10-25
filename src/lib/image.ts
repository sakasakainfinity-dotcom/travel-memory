export async function compress(file: File, maxW = 1600, quality = 0.8): Promise<Blob> {
  // 🔸 ① HEIC/HEIFの場合はJPEGに変換して扱う
  const type = file.type.includes("heic") || file.type.includes("heif") ? "image/jpeg" : file.type;

  let bmp: ImageBitmap;
  try {
    // 🔸 ② 通常は createImageBitmap で高速処理
    bmp = await createImageBitmap(file);
  } catch {
    // 🔸 ③ HEICで失敗したときは、旧式の <img> 読み込みにフォールバック
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });

    // 🔸 ④ HTMLCanvasElement（OffscreenCanvas非対応なSafariでもOK）
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxW / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    // 🔸 ⑤ Safari対応 toBlob でJPEG化
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
  }

  // 🔸 ⑥ 通常パス（HEIC以外）
  const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

  // 🔸 ⑦ ここも type を動的にして、JPEG/PNG/HEICを自動変換
  return (await canvas.convertToBlob({ type, quality })) as Blob;
}



