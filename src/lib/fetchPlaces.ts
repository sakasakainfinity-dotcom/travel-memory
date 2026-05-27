"use client";

import { supabase } from "./supabaseClient";

export type PlaceWithPhotos = {
  id: string;
  title?: string | null;
  name?: string | null;
  lat: number;
  lng: number;
  memo?: string | null;
  photos?: string[] | null;
  createdBy?: string | null;
  createdById?: string | null;
  tags?: string[] | null;
  municipalityKey: string;
  municipalityName: string;
  prefectureName: string;
  firstExplorerUserId?: string | null;
};

export async function fetchPlaces(): Promise<PlaceWithPhotos[]> {
  const { data: places, error: e1 } = await supabase
    .from("places")
    .select("id, title, memo, lat, lng, created_by, created_by_name, tags, municipality_key, municipality_name, prefecture_name, first_explorer_user_id")
    .eq("visibility", "public")
    .order("created_at", { ascending: false });

  if (e1) throw e1;

  const placeIds = (places ?? []).map((p) => p.id);
  const photosByPlace: Record<string, string[]> = {};
  if (placeIds.length > 0) {
    const { data: photos, error: e2 } = await supabase
      .from("photos")
      .select("place_id, file_url, url")
      .in("place_id", placeIds);
    if (e2) throw e2;

    for (const ph of photos ?? []) {
      const resolved = ph.file_url ?? ph.url;
      if (!resolved) continue;
      if (!photosByPlace[ph.place_id]) photosByPlace[ph.place_id] = [];
      photosByPlace[ph.place_id].push(resolved);
    }
  }

  return (places ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    name: p.title,
    memo: p.memo,
    lat: p.lat,
    lng: p.lng,
    photos: photosByPlace[p.id] ?? [],
    createdBy: p.created_by_name ?? "名無しの旅人",
    createdById: p.created_by,
    tags: p.tags ?? [],
    municipalityKey: p.municipality_key ?? "unknown",
    municipalityName: p.municipality_name ?? "不明",
    prefectureName: p.prefecture_name ?? "不明",
    firstExplorerUserId: p.first_explorer_user_id,
  }));
}
