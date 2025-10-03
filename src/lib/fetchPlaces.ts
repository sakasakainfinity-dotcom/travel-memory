// src/lib/fetchPlaces.ts
"use client";

import { supabase } from "./supabaseClient";
import { ensureMySpace } from "./ensureMySpace";

export type PlaceWithPhotos = {
  id: string;
  name?: string | null;
  lat: number;
  lng: number;
  memo?: string | null;
  photos?: string[] | null;
};

export async function fetchPlaces(): Promise<PlaceWithPhotos[]> {
  const { data: ses, error: eSess } = await supabase.auth.getSession();
  if (eSess) throw eSess;
  if (!ses.session) return [];

  const mySpace = await ensureMySpace();
  if (!mySpace?.id) return [];

  // places
  const { data: places, error: e1 } = await supabase
    .from("places")
    .select("id, title, memo, lat, lng")
    .eq("space_id", mySpace.id)
    .order("created_at", { ascending: false });

  if (e1) throw e1;

  // photos（まとめて引いて group）
  const placeIds = (places ?? []).map((p) => p.id);
  let photosByPlace: Record<string, string[]> = {};
  if (placeIds.length > 0) {
    const { data: photos, error: e2 } = await supabase
      .from("photos")
      .select("place_id, url")
      .in("place_id", placeIds);
    if (e2) throw e2;

    for (const ph of photos ?? []) {
      if (!photosByPlace[ph.place_id]) photosByPlace[ph.place_id] = [];
      photosByPlace[ph.place_id].push(ph.url);
    }
  }

  return (places ?? []).map((p) => ({
    id: p.id,
    name: p.title,
    memo: p.memo,
    lat: p.lat,
    lng: p.lng,
    photos: photosByPlace[p.id] ?? [],
  }));
}
