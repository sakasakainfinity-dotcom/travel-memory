// src/lib/convertToUploadableImage.ts
export async function convertToUploadableImage(file: File): Promise<File> {
  const name = file.name || "unknown";
  const type = (file.type || "").toLowerCase();

  // 軽量HEIC判定（拡張子/先頭バイト）
  let looksHeic = /image\/hei[cf]/.test(type) || /\.hei[cf]$/i.test(name);
  if (!looksHeic) {
    try {
      const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      const ascii = new TextDecoder().decode(head);
      looksHeic = ascii.includes("ftypheic") || ascii.includes("ftypheif") || ascii.includes("ftyphevc");
    } catch {/* no-op */}
  }

  // 変換しない方針：呼ばれても“安全に何もしない”で返す
  if (!looksHeic) return file;

  try {
    const heic2any = (await import("heic2any")).default as any;
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    return new File([blob as BlobPart], name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (e) {
    // iOSでWASM失敗など → 原本のまま返す（絶対に落とさない）
    return file;
  }
}

