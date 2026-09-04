export type StayCategory = { id: string; name: string; slug: string };
export type StaySpot = {
  id: string; name: string; latitude: number; longitude: number; address?: string | null;
  google_maps_url?: string | null; image_url?: string | null; description?: string | null;
  distance_label?: string | null; walking_time?: string | null; driving_time?: string | null;
  business_hours?: string | null; closed_days?: string | null; website_url?: string | null;
  instagram_url?: string | null; categories: StayCategory[]; host_comment: string;
  local_comment?: string | null;
  is_featured: boolean; sort_order: number;
};
export type StayMap = { id: string; name: string; slug: string; subtitle?: string | null; description?: string | null; image_url?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; spots: StaySpot[] };

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat); const dLng = rad(bLng - aLng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
