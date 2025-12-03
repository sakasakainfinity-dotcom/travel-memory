// src/app/api/yahoo-poi/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const query = searchParams.get("q") ?? "";
  const dist = searchParams.get("dist") ?? "2"; // 2km以内

  if (!lat || !lon) {
    return NextResponse.json({ error: "lat/lon required" }, { status: 400 });
  }

  const appid = process.env.NEXT_PUBLIC_YAHOO_APPID;
  if (!appid) {
    return NextResponse.json({ error: "NO_APPID" }, { status: 500 });
  }

  const url = `https://map.yahooapis.jp/search/local/V1/localSearch?appid=${appid}&lat=${lat}&lon=${lon}&dist=${dist}&query=${encodeURIComponent(
    query
  )}&sort=dist&output=json`;

  const res = await fetch(url);
  const json = await res.json();

  const items =
    json.Feature?.map((f: any) => {
      const [lon2, lat2] = f.Geometry.Coordinates.split(",").map(Number);
      return {
        id: f.Id,
        name: f.Name,
        lat: lat2,
        lon: lon2,
        category: f.Category,
        address: f.Property?.Address,
      };
    }) ?? [];

  return NextResponse.json({ count: items.length, items });
}
