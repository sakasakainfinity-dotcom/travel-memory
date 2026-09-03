import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/server/env";

const allowed = new Set(["map_view", "spot_view", "google_maps_click"]);
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!allowed.has(body.eventType) || !body.stayId) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    const { url, anonKey } = getSupabasePublicEnv();
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await client.from("stay_map_events").insert({ event_type: body.eventType, stay_id: body.stayId, spot_id: body.spotId || null });
    if (error) throw error; return new NextResponse(null, { status: 204 });
  } catch { return NextResponse.json({ error: "Event was not recorded" }, { status: 503 }); }
}
