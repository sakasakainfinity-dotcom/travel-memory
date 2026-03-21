// src/app/api/yahoo-geocode/route.ts
import { NextResponse } from "next/server";
import { getYahooAppId } from "@/lib/server/env";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const appid = getYahooAppId();
  if (!appid) {
    return NextResponse.json({ error: "NO_APPID" }, { status: 500 });
  }

  const url = `https://map.yahooapis.jp/geocode/V1/geoCoder?appid=${appid}&query=${encodeURIComponent(
    q
  )}&output=json`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json.Feature || json.Feature.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const f = json.Feature[0];
  const [lon, lat] = f.Geometry.Coordinates.split(",").map(Number);

  return NextResponse.json({
    name: f.Name,
    lat,
    lon,
    raw: f,
  });
}
