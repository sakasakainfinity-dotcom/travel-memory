import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/image";
import { createBrowserSafeId } from "@/lib/browserSafeId";

export type PhotoRow = {
  id: string;
  place_id: string;
  file_url: string;
  storage_path: string;
};

export async function uploadPlacePhotos({
  placeId,
  spaceId,
  files,
}: {
  placeId: string;
  spaceId: string;
  files: File[];
}): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const compressed = await compressImage(file, {
      maxSide: 1600,
      quality: 0.8,
      targetMaxBytes: Math.min(350 * 1024, Math.max(120 * 1024, Math.floor(file.size * 0.1))),
    });
    const extension = getExtensionFromType(compressed.type);
    const path = `${placeId}/${createBrowserSafeId()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("photos").upload(path, compressed, {
      contentType: compressed.type || getContentTypeFromExtension(extension),
      upsert: false,
    });
    if (uploadError) {
      console.error("画像アップロード失敗:", uploadError);
      throw new Error(`[UPLOAD] ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from("photos").getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from("photos").insert({
      space_id: spaceId,
      place_id: placeId,
      file_url: publicUrl,
      storage_path: path,
    });
    if (insertError) {
      console.error("photos insert 失敗:", insertError);
      throw new Error(`[PHOTOS] ${insertError.message}`);
    }

    uploadedUrls.push(publicUrl);
  }

  return uploadedUrls;
}

export async function replacePlacePhotos({
  placeId,
  spaceId,
  files,
}: {
  placeId: string;
  spaceId: string;
  files: File[];
}): Promise<string[]> {
  const existingPhotos = await fetchPlacePhotos(placeId);
  const paths = existingPhotos.map((photo) => photo.storage_path).filter(Boolean);

  console.log("削除対象:", paths.length);
  console.log("新規アップロード:", files.length);

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("photos").remove(paths);
    if (storageError) {
      console.error("storage 削除失敗:", storageError);
      throw new Error(`[STORAGE_REMOVE] ${storageError.message}`);
    }
  }

  const { error: deleteError } = await supabase.from("photos").delete().eq("place_id", placeId);
  if (deleteError) {
    console.error("photos delete 失敗:", deleteError);
    throw new Error(`[PHOTOS_DELETE] ${deleteError.message}`);
  }

  return uploadPlacePhotos({ placeId, spaceId, files });
}

export async function deletePlaceWithPhotos(placeId: string) {
  const existingPhotos = await fetchPlacePhotos(placeId);
  const paths = existingPhotos.map((photo) => photo.storage_path).filter(Boolean);

  console.log("削除対象:", paths.length);

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("photos").remove(paths);
    if (storageError) {
      console.error("storage 削除失敗:", storageError);
      throw new Error(`[STORAGE_REMOVE] ${storageError.message}`);
    }
  }

  const { error: deletePhotosError } = await supabase.from("photos").delete().eq("place_id", placeId);
  if (deletePhotosError) {
    console.error("photos delete 失敗:", deletePhotosError);
    throw new Error(`[PHOTOS_DELETE] ${deletePhotosError.message}`);
  }

  const { error: deletePlaceError } = await supabase.from("places").delete().eq("id", placeId);
  if (deletePlaceError) {
    console.error("places delete 失敗:", deletePlaceError);
    throw new Error(`[PLACE_DELETE] ${deletePlaceError.message}`);
  }
}

export async function fetchPlacePhotos(placeId: string): Promise<PhotoRow[]> {
  const { data, error } = await supabase
    .from("photos")
    .select("id, place_id, file_url, storage_path")
    .eq("place_id", placeId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("photos 取得失敗:", error);
    throw new Error(`[PHOTOS_FETCH] ${error.message}`);
  }

  return (data ?? []) as PhotoRow[];
}

function getExtensionFromType(type: string) {
  if (type === "image/webp") return "webp";
  return "jpg";
}

function getContentTypeFromExtension(extension: string) {
  return extension === "webp" ? "image/webp" : "image/jpeg";
}
