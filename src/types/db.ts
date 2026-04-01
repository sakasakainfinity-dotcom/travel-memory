// src/types/db.ts
export type Place = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  visited_at: string | null;
  space_id: string;
  created_by: string;
  created_at: string;
  visibility: "public" | "private" | "pair";
  status?: "wishlist" | "visited";
  source_place_id?: string | null;
  source_visibility?: "public" | "private" | null;
  ai_summary?: string | null;
  ai_tips?: string | null;
  ai_generated_at?: string | null;
};

export type Photo = {
  id: string;
  place_id: string;
  url?: string | null;
  file_url?: string | null;
  storage_path: string | null;
  created_at: string;
  camera_make?: string | null;
  camera_model?: string | null;
  lens_model?: string | null;
  f_number?: number | null;
  exposure_time?: string | null;
  iso?: number | null;
  focal_length?: number | null;
  taken_at?: string | null;
  orientation?: number | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  has_gps?: boolean | null;
};

export type SpotCollection = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  share_slug: string;
  created_at: string;
  updated_at: string;
};

export type SpotCollectionItem = {
  id: string;
  collection_id: string;
  place_id: string;
  sort_order: number;
  created_at: string;
};
