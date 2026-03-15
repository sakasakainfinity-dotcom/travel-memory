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
};

export type Photo = {
  id: string;
  place_id: string;
  url: string;
  storage_path: string | null;
  created_at: string;
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

