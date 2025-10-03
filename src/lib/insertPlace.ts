// src/lib/insertPlace.ts
"use client";

import { supabase } from "./supabaseClient";
import { ensureMySpace } from "./ensureMySpace";

export type NewPlaceInput = {
  title?: string;
  memo?: string;
  lat: number;
  lng: number;
  visitedAt?: string;
  files: File[]; // 写真
};

export type InsertedPlace = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  visited_at: string | null;
  photos: string[]; // 公開URL（地図プレビュー用）
};

export async function insertPlace(input: NewPlaceInput): Promise<InsertedPlace> {
  // 1) セッション & space
  const { data: ses, error: eSess } = await supabase.auth.getSession();
  if (eSess) throw eSess;
  const uid = ses.session?.user.id;
  if (!uid) throw new Error("ログインが必要です");

  const mySpace = await ensureMySpace();
  if (!mySpace?.id) throw new Error("スペースが取得できませんでした");

  // 2) places 挿入
  const { data: placeRow, error: ePlace } = await supabase
    .from("places")
    .insert({
      space_id: mySpace.id,
      title: input.title ?? null,
      memo: input.memo ?? null,
      lat: input.lat,
      lng: input.lng,
      visited_at: input.visitedAt ?? null,
      created_by: uid,
    })
    .select("id, title, memo, lat, lng, visited_at")
    .single();

  if (ePlace) throw ePlace;

  // 3) 画像アップロード（Storage 'photos'）→ 公開URL取得 → photos テーブルへ
  const urls: string[] = [];
  for (const f of input.files ?? []) {
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${placeRow.id}/${crypto.randomUUID()}.${ext}`;
    const { error: eUp } = await supabase.storage.from("photos").upload(fileName, f, {
      upsert: false,
      cacheControl: "3600",
    });
    if (eUp) throw eUp;

    const { data: pub } = supabase.storage.from("photos").getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;
    urls.push(publicUrl);

    const { error: ePhoto } = await supabase
      .from("photos")
      .insert({ place_id: placeRow.id, url: publicUrl, storage_path: fileName });
    if (ePhoto) throw ePhoto;
  }

  return {
    id: placeRow.id,
    title: placeRow.title,
    memo: placeRow.memo,
    lat: placeRow.lat,
    lng: placeRow.lng,
    visited_at: placeRow.visited_at,
    photos: urls,
  };
}

