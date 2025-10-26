// src/lib/convertToUploadableImage.ts
export async function convertToUploadableImage(file: File): Promise<File> {
  const name = file.name || "image.heic";
  const type = (file.type || "").toLowerCase();
  const isHeic = /image\/hei[cf]/.test(type) || /\.hei[cf]$/i.test(name);
  if (!isHeic) return file;

  // heic2any はブラウザ専用（SSRでは呼ばない）
  const heic2any = (await import("heic2any")).default as any;
  const blob = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });

  return new File([blob as BlobPart], name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
