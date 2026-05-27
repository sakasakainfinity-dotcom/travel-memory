// src/types/db.ts
export type Place = {
  id: string;
  title: string | null;
  memo: string | null;
  lat: number;
  lng: number;
  visited_at: string | null;
  created_by: string;
  created_at: string;
  visibility: "public" | "private" | "pair";
  prefecture_name?: string | null;
  municipality_name?: string | null;
  municipality_key?: string | null;
  municipality_code?: string | null;
  tags?: string[] | null;
  status?: string | null;
  first_explorer_user_id?: string | null;
  status_legacy?: "wishlist" | "visited";
  source_place_id?: string | null;
  source_visibility?: "public" | "private" | null;
  ai_summary?: string | null;
  ai_tips?: string | null;
  ai_generated_at?: string | null;
};

export type Profile = {
  id: string;
  total_points: number;
  rank_key?: string | null;
  opened_municipality_count?: number | null;
  opened_prefecture_count?: number | null;
};

export type MunicipalityProgress = {
  id: string;
  user_id: string;
  municipality_key: string;
  prefecture_name: string;
  municipality_name: string;
  first_post_id: string;
  post_count_in_municipality: number;
  municipality_rank_key: "starter" | "supporter" | "expert" | "legend";
  is_first_explorer: boolean;
  created_at: string;
  updated_at: string;
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
