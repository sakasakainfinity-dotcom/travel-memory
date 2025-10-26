export async function convertToUploadableImage(file: File): Promise<File> {
  const name = file.name || "unknown";
  const type = (file.type || "").toLowerCase();

  // 1) MIME/拡張子で判定
  let looksHeic = /image\/hei[cf]/.test(type) || /\.hei[cf]$/i.test(name);

  // 2) それでも不明なら、先頭バイトを嗅ぐ（ftypheic/heif/hevc）
  if (!looksHeic) {
    const head = new Uint8Array(await file.slice(0, 24).arrayBuffer());
    const ascii = new TextDecoder().decode(head);
    // ISO BMFF: "ftyp"の後に"heic"/"heif"/"hevc"等が来る
    looksHeic = ascii.includes("ftypheic") || ascii.includes("ftypheif") || ascii.includes("ftyphevc");
  }

  if (!looksHeic) return file;

  const heic2any = (await import("heic2any")).default as any;
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });

  return new File([blob as BlobPart], name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

