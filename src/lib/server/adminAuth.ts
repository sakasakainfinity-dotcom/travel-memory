import "server-only";

import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";

export async function requireAdmin(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_admin) throw new Error("FORBIDDEN");
  return { admin, actorId: data.user.id };
}
