// src/app/api/yahoo-local/route.ts
import { NextRequest, NextResponse } from "next/server";

// レスポンスで返したい形
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
  const dist = searchParams.get("dist") ?? "5"; // km（最大20）
  const q = searchParams.get("q") ?? "";

  if (!lat || !lon || !q) {
    return NextResponse.json(
      { error: "lat, lon, q は必須です" },
      { status: 400 }
    );
  }

  const appid = process.env.YAHOO_APP_ID;
  if (!appid) {
    console.error("YAHOO_APP_ID が設定されていません");
    return NextResponse.json(
      { error: "server config error" },
      { status: 500 }
    );
  }

  const url =
    "https://map.yahooapis.jp/search/local/V1/localSearch" +
    `?appid=${encodeURIComponent(appid)}` +
    `&lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&dist=${encodeURIComponent(dist)}` +
    `&query=${encodeURIComponent(q)}` +
    "&results=20" +
    "&sort=geo" +
    "&output=json";

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error("Yahoo localSearch error", res.status, text);
      return NextResponse.json(
        { error: "yahoo local search error" },
        { status: 500 }
      );
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
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}

