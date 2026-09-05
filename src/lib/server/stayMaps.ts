import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { StayMap, StaySpot } from "../stayMaps";

export async function getPublishedStayMap(slug: string): Promise<StayMap | null> {
  const admin = getSupabaseAdmin();
  const { data: stay, error } = await admin.from("stays").select("id,name,slug,subtitle,description,image_url,address,latitude,longitude").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  if (!stay) return null;
  const spotFields = "is_featured,sort_order,spot:stay_spots!inner(id,name,latitude,longitude,address,google_maps_url,image_url,description,distance_label,walking_time,driving_time,business_hours,closed_days,website_url,instagram_url,is_published,categories:stay_spot_category_links(category:stay_spot_categories(id,name,slug)))";
  const currentResult = await admin.from("stay_recommendations").select(`host_comment,local_comment,${spotFields}`).eq("stay_id", stay.id).eq("is_published", true).eq("spot.is_published", true).order("sort_order");
  let data: any[] | null = currentResult.data;
  let spotError = currentResult.error;

  // local_comment was added after the map launched. Keep maps and newly-created
  // recommendations working during a rolling deploy where the migration may lag.
  if (isMissingLocalComment(spotError)) {
    const compatibleResult = await admin.from("stay_recommendations").select(`host_comment,${spotFields}`).eq("stay_id", stay.id).eq("is_published", true).eq("spot.is_published", true).order("sort_order");
    data = compatibleResult.data;
    spotError = compatibleResult.error;
  }
  if (spotError) throw spotError;
  const spots = (data ?? []).map((row: any) => ({ ...row.spot, host_comment: row.host_comment, local_comment: row.local_comment, is_featured: row.is_featured, sort_order: row.sort_order, categories: (row.spot.categories ?? []).map((link: any) => link.category) })) as StaySpot[];
  return { ...(stay as Omit<StayMap, "spots">), spots };
}

function isMissingLocalComment(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204") && error.message?.includes("local_comment"));
}
