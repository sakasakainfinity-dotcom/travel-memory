// src/app/api/yahoo-local/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getYahooAppId } from "@/lib/server/env";

type LocalItem = {
  name: string;
  lat: number;
  lon: number;
  address?: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const dist = searchParams.get("dist") ?? "5";
  const q = searchParams.get("q") ?? "";

  if (!q) {
    return NextResponse.json({ items: [], error: "q is required" });
  }

  const appid = getYahooAppId();
  if (!appid) {
    console.error("Yahoo APPID missing");
    return NextResponse.json({ items: [], error: "missing appid" });
  }

  let url =
    "https://map.yahooapis.jp/search/local/V1/localSearch" +
    `?appid=${encodeURIComponent(appid)}` +
    `&query=${encodeURIComponent(q)}` +
    "&results=20" +
    "&output=json";

  if (lat && lon) {
    url +=
      `&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&dist=${encodeURIComponent(dist)}` +
      "&sort=geo";
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error("Yahoo localSearch error", res.status, text);
      return NextResponse.json({
        items: [],
        error: `upstream ${res.status}`,
      });
    }

    const data = await res.json();
    const features: any[] = data.Feature ?? [];

    const items: LocalItem[] = features
      .map((f): LocalItem | null => {
        const name: string = f.Name ?? "";
        const coords: string = f.Geometry?.Coordinates ?? "";
        const [lonStr, latStr] = coords.split(",");
        const latNum = parseFloat(latStr);
        const lonNum = parseFloat(lonStr);
        const address: string | undefined = f.Property?.Address;

        if (!name || isNaN(latNum) || isNaN(lonNum)) return null;

        return {
          name,
          lat: latNum,
          lon: lonNum,
          address,
        };
      })
      .filter((x): x is LocalItem => x !== null);

    return NextResponse.json({ items });
  } catch (e) {
    console.error("yahoo-local route error", e);
    return NextResponse.json({
      items: [],
      error: "fetch failed",
    });
  }
}
