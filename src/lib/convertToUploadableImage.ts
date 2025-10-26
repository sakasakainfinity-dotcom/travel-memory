// src/lib/convertToUploadableImage.ts
export async function convertToUploadableImage(file: File): Promise<File> {
  const name = file.name || "unknown";
  const type = (file.type || "").toLowerCase();

  // 1) MIME/拡張子で判定
  let looksHeic = /image\/hei[cf]/.test(type) || /\.hei[cf]$/i.test(name);

  // 2) それでも不明なら、先頭バイトを嗅ぐ（"ftypheic"/"heif"/"hevc"）
  if (!looksHeic) {
    try {
      const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      const ascii = new TextDecoder().decode(head);
      looksHeic =
        ascii.includes("ftypheic") ||
        ascii.includes("ftypheif") ||
        ascii.includes("ftyphevc");
    } catch {
      // 失敗時は無視
    }
  }

  if (!looksHeic) return file;

  const heic2any = (await import("heic2any")).default as any;
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });

  return new File([blob as BlobPart], name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

