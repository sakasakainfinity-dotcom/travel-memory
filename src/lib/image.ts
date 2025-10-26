// src/lib/image.ts
// iOSのHEIC/HDR/Liveでも確実に通すため、常に <img>→canvas→JPEG で再エンコード

export async function compress(file: File, maxW = 1600, quality = 0.82): Promise<Blob> {
  // ① File を dataURL に読み込む（iOSはこれが一番安定）
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file); // HEIC/HEIF/HDR でも通る
  });

  // ② <img> に食わせて、decode 完了を待つ
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  // ③ リサイズ（長辺 maxW）＆ JPEG で再エンコード
  const scale = Math.min(1, maxW / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  // ④ JPEG化（PNGにしたいなら 'image/png' に）※ここはJPEG固定でOK
  const jpegBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
  );

  return jpegBlob;
}



