// src/lib/image.ts （例）
import { convertToUploadableImage } from "./convertToUploadableImage";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function uploadToStorage(raw: File) {
  // ★ 二重ガード
  const f = await convertToUploadableImage(raw);

  // 画面に出すログが欲しければ、呼び出し側で表示
  const path = `photos/${crypto.randomUUID()}-${f.name}`;
  const { data, error } = await supabase.storage.from("photos").upload(path, f, {
    contentType: f.type, // ← "image/jpeg" になってるはず
    upsert: false,
  });

  if (error) throw error;
  return data;
}




