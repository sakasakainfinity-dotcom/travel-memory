import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "./env";

const COOKIE_NAME = "pm_coupon_partner";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function signature(payload: string) {
  return createHmac("sha256", getRequiredEnv("COUPON_PARTNER_SESSION_SECRET")).update(payload).digest("base64url");
}

export function createPartnerSession(storeId: string) {
  const payload = Buffer.from(JSON.stringify({ storeId, expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readPartnerSession(request: NextRequest): string | null {
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [payload, received, extra] = value.split(".");
  if (!payload || !received || extra) return null;
  const expected = signature(payload);
  const a = Buffer.from(received), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { storeId?: unknown; expiresAt?: unknown };
    return typeof parsed.storeId === "string" && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now() ? parsed.storeId : null;
  } catch { return null; }
}

export function setPartnerSession(response: NextResponse, value: string) {
  response.cookies.set(COOKIE_NAME, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: MAX_AGE_SECONDS });
}

export function clearPartnerSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}
