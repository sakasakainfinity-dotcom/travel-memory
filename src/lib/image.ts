// src/lib/image.ts
export async function compress(file: File, maxW = 1600, quality = 0.82): Promise<Blob> {
  // 1. HEIC / HEIF 対策: FileReaderでBase64に
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 2. <img>タグで読み込んでCanvasへ描画
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  // 3. 長辺をmaxWにリサイズ
  const scale = Math.min(1, maxW / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context取得失敗");
  ctx.drawImage(img, 0, 0, w, h);

  // 4. JPEG変換（Safari用にPromiseラップ）
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject("JPEG変換失敗")),
      "image/jpeg",
      quality
    );
  });

  return blob;
}



