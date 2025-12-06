// src/app/api/place-search/route.ts
import { NextResponse } from "next/server";

type SearchResult = {
  name: string;
  lat: number;
  lon: number;
  address?: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const paramLat = searchParams.get("lat");
  const paramLon = searchParams.get("lon");
  const dist = Number(searchParams.get("dist") || "5"); // km

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const appid = process.env.NEXT_PUBLIC_YAHOO_APPID;
  if (!appid) {
    console.error("YAHOO_APP_ID が env に設定されてないよ");
    return NextResponse.json(
      { error: "YAHOO_APP_ID not set" },
      { status: 500 }
    );
  }

  const items: SearchResult[] = [];

  // ---------- Step1: ジオコーダ ----------
  let baseLat: number | null = null;
  let baseLon: number | null = null;

  try {
    const geoUrl =
      "https://map.yahooapis.jp/geocode/V2/geoCoder?" +
      new URLSearchParams({
        appid,
        query: q,
        output: "json",
      });

    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      throw new Error(`geocoder status ${geoRes.status}`);
    }
    const geoJson: any = await geoRes.json();

    const features: any[] =
      geoJson.Feature ??
      geoJson.YDF?.Feature ??
      (Array.isArray(geoJson) ? geoJson : []);

    if (Array.isArray(features) && features.length > 0) {
      const f0 = features[0];
      const coordStr: string | undefined =
        f0?.Geometry?.Coordinates ??
        (typeof f0?.Geometry === "string" ? f0.Geometry : undefined);

      if (coordStr) {
        const [lonStr, latStr] = coordStr.split(",");
        baseLat = Number(latStr);
        baseLon = Number(lonStr);

        if (!Number.isNaN(baseLat) && !Number.isNaN(baseLon)) {
          items.push({
            name: f0?.Name || q,
            lat: baseLat,
            lon: baseLon,
            address: f0?.Property?.Address,
          });
        } else {
          baseLat = null;
          baseLon = null;
        }
      }
    }
  } catch (e) {
    console.error("geocoder error", e);
  }

  // geocoder がダメでも、パラメータで中心が来てたら使う
  if (baseLat == null && paramLat && paramLon) {
    baseLat = Number(paramLat);
    baseLon = Number(paramLon);
    if (Number.isNaN(baseLat) || Number.isNaN(baseLon)) {
      baseLat = null;
      baseLon = null;
    }
  }

  // ---------- Step2: ローカルサーチ ----------
  try {
    const lsParams: Record<string, string> = {
      appid,
      output: "json",
      results: "20",
      query: q,
      sort: "hybrid",
    };

    if (baseLat != null && baseLon != null) {
      lsParams.lat = String(baseLat);
      lsParams.lon = String(baseLon);
      lsParams.dist = String(dist);
    }

    const lsUrl =
      "https://map.yahooapis.jp/search/local/V1/localSearch?" +
      new URLSearchParams(lsParams);

    const lsRes = await fetch(lsUrl);
    if (!lsRes.ok) {
      throw new Error(`localSearch status ${lsRes.status}`);
    }
    const lsJson: any = await lsRes.json();

    const features: any[] =
      lsJson.Feature ??
      lsJson.YDF?.Feature ??
      (Array.isArray(lsJson) ? lsJson : []);

    if (Array.isArray(features)) {
      for (const f of features) {
        const coordStr: string | undefined =
          f?.Geometry?.Coordinates ??
          (typeof f?.Geometry === "string" ? f.Geometry : undefined);
        if (!coordStr) continue;
        const [lonStr, latStr] = coordStr.split(",");
        const lat = Number(latStr);
        const lon = Number(lonStr);
        if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

        items.push({
          name: f?.Name || q,
          lat,
          lon,
          address: f?.Property?.Address,
        });
      }
    }
  } catch (e) {
    console.error("localSearch error", e);
  }

  // ---------- Step3: 場所情報API ----------
  try {
    if (baseLat != null && baseLon != null) {
      const placeUrl =
        "https://map.yahooapis.jp/placeinfo/V1/get?" +
        new URLSearchParams({
          appid,
          lat: String(baseLat),
          lon: String(baseLon),
          output: "json",
        });

      const placeRes = await fetch(placeUrl);
      if (placeRes.ok) {
        const placeJson: any = await placeRes.json();
        const rs = placeJson.ResultSet;
        const addressText = Array.isArray(rs?.Address)
          ? rs.Address.join(" ")
          : undefined;
        const results: any[] = rs?.Result ?? [];

        for (const r of results) {
          items.push({
            name: r?.Combined || r?.Name || "",
            lat: baseLat,
            lon: baseLon,
            address: addressText,
          });
        }
      }
    }
  } catch (e) {
    console.error("placeinfo error", e);
  }

  // ---------- 重複除去 ----------
  const seen = new Set<string>();
  const uniq = items.filter((it) => {
    // 座標なければ捨てる
    if (
      typeof it.lat !== "number" ||
      typeof it.lon !== "number" ||
      Number.isNaN(it.lat) ||
      Number.isNaN(it.lon)
    ) {
      return false;
    }
    const key = `${it.name}|${it.lat.toFixed(6)}|${it.lon.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json({ items: uniq });
}
