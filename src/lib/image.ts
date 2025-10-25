export async function compress(file: File, maxW = 1600, quality = 0.8): Promise<Blob> {
  // 1️⃣ HEIC / HEIF 対応（iPhone HDR写真対策）
  if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // HEIC → JPEG に変換（iOS Safari対策）
    const img = document.createElement("img");
    img.src = dataUrl;
    await new Promise((res) => (img.onload = res));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const jpegBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
    );

    return jpegBlob;
  }

  // 2️⃣ 通常JPEG/PNGの圧縮処理
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) {
    // decode失敗時（HDRや16bit対応外フォーマット）→ fallback
    const fallbackUrl = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.src = fallbackUrl;
    await new Promise((res) => (img.onload = res));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
    );
    URL.revokeObjectURL(fallbackUrl);
    return blob;
  }

  // 通常処理
  const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
  const canvas = new OffscreenCanvas(
    Math.round(bmp.width * scale),
    Math.round(bmp.height * scale)
  );
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

  return (await canvas.convertToBlob({ type: "image/jpeg", quality })) as Blob;
}

