import "server-only";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { StayMap, StaySpot } from "../stayMaps";

export async function getPublishedStayMap(slug: string): Promise<StayMap | null> {
  const admin = getSupabaseAdmin();
  const { data: stay, error } = await admin.from("stays").select("id,name,slug,subtitle,description,image_url,address,latitude,longitude").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  if (!stay) return null;
  const rows = await getAllPublishedRecommendations(admin, stay.id);
  const spots = rows.map((row: any) => ({ ...row.spot, host_comment: row.host_comment, local_comment: row.local_comment, is_featured: row.is_featured, sort_order: row.sort_order, categories: (row.spot.categories ?? []).map((link: any) => link.category) })) as StaySpot[];
  return { ...(stay as Omit<StayMap, "spots">), spots };
}

const PAGE_SIZE = 500;
const spotFields = "spot_id,is_featured,sort_order,created_at,spot:stay_spots!inner(id,name,latitude,longitude,address,google_maps_url,image_url,description,distance_label,walking_time,driving_time,business_hours,closed_days,website_url,instagram_url,is_published,categories:stay_spot_category_links(category:stay_spot_categories(id,name,slug)))";

async function getAllPublishedRecommendations(admin: ReturnType<typeof getSupabaseAdmin>, stayId: string) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    let result = await admin.from("stay_recommendations").select(`host_comment,local_comment,${spotFields}`).eq("stay_id", stayId).eq("is_published", true).eq("spot.is_published", true).order("sort_order").order("created_at").order("spot_id").range(from, to);
    if (isMissingLocalComment(result.error)) {
      result = await admin.from("stay_recommendations").select(`host_comment,${spotFields}`).eq("stay_id", stayId).eq("is_published", true).eq("spot.is_published", true).order("sort_order").order("created_at").order("spot_id").range(from, to) as typeof result;
    }
    if (result.error) throw result.error;
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function isMissingLocalComment(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42703" || error.code === "PGRST204") && error.message?.includes("local_comment"));
}
