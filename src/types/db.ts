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
