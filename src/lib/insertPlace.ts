"use client";

import { supabase } from "./supabaseClient";
import { createBrowserSafeId } from "./browserSafeId";
import { reverseGeocodeMunicipality } from "./municipality";
import { compressImage } from "./image";

export type NewPlaceInput = {
  title?: string;
  memo?: string;
  lat: number;
  lng: number;
  visitedAt?: string;
  files: File[];
  tags?: string[];
};

export type InsertedPlace = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  visited_at: string | null;
  photos: string[];
  municipality_key: string;
  municipality_name: string;
  prefecture_name: string;
  is_first_explorer: boolean;
};

export async function insertPlace(input: NewPlaceInput): Promise<InsertedPlace> {
  const { data: ses, error: eSess } = await supabase.auth.getSession();
  if (eSess) throw eSess;
  const uid = ses.session?.user.id;
  if (!uid) throw new Error("ログインが必要です");
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  const displayName =
    (user?.user_metadata as any)?.display_name ||
    (user?.user_metadata as any)?.name ||
    (user?.email?.split("@")[0] ?? "名無しの旅人");

  const geo = await reverseGeocodeMunicipality(input.lat, input.lng);

  const { data: placeRow, error: ePlace } = await supabase
    .from("places")
    .insert({
      title: input.title ?? null,
      memo: input.memo ?? null,
      lat: input.lat,
      lng: input.lng,
      visited_at: input.visitedAt ?? null,
      created_by: uid,
      created_by_name: displayName,
      visibility: "public",
      prefecture_name: geo.prefectureName,
      municipality_name: geo.municipalityName,
      municipality_key: geo.municipalityKey,
      municipality_code: geo.municipalityCode,
      tags: input.tags ?? [],
      status: "active",
    })
    .select("id, title, memo, lat, lng, visited_at, municipality_key, municipality_name, prefecture_name")
    .single();

  if (ePlace) throw ePlace;

  const urls: string[] = [];
  for (const f of input.files ?? []) {
    const compressed = await compressImage(f, {
      maxSide: 1280,
      quality: 0.68,
      targetMaxBytes: Math.min(350 * 1024, Math.max(120 * 1024, Math.floor(f.size * 0.1))),
    });
    const ext = compressed.type === "image/webp" ? "webp" : compressed.type === "image/png" ? "png" : "jpg";
    const fileName = `${placeRow.id}/${createBrowserSafeId()}.${ext}`;
    const { error: eUp } = await supabase.storage.from("photos").upload(fileName, compressed, {
      upsert: false,
      cacheControl: "3600",
      contentType: compressed.type || "image/jpeg",
    });
    if (eUp) throw eUp;

    const { data: pub } = supabase.storage.from("photos").getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;
    urls.push(publicUrl);

    const { error: ePhoto } = await supabase
      .from("photos")
      .insert({ place_id: placeRow.id, file_url: publicUrl, storage_path: fileName });
    if (ePhoto) throw ePhoto;
  }

  const { data: progress } = await supabase
    .from("municipality_progress")
    .select("is_first_explorer")
    .eq("user_id", uid)
    .eq("municipality_key", geo.municipalityKey)
    .maybeSingle();

  return {
    id: placeRow.id,
    title: placeRow.title,
    memo: placeRow.memo,
    lat: placeRow.lat,
    lng: placeRow.lng,
    visited_at: placeRow.visited_at,
    photos: urls,
    municipality_key: placeRow.municipality_key,
    municipality_name: placeRow.municipality_name,
    prefecture_name: placeRow.prefecture_name,
    is_first_explorer: !!progress?.is_first_explorer,
  };
}
