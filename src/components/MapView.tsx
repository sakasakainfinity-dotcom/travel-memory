// src/components/MapView.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type Place = {
  id: string;
  name?: string | null;
  memo?: string | null;
  lat: number;
  lng: number;
  photos?: string[];
  postCount?: number;
  visibility?: "public" | "private" | "pair" | "pilgrimage" | string;
  wantedByMe?: boolean;
  visitedByMe?: boolean;
};

type View = { lat: number; lng: number; zoom: number };

function isPublicModeCandidate(p: Place) {
  return typeof p.wantedByMe === "boolean" || typeof p.visitedByMe === "boolean";
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadSvgAsImage(map: any, name: string, svg: string) {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
      resolve();
    };
    img.onerror = reject;
    img.src = svgToDataUrl(svg);
  });
}

const CAMERA_PUBLIC_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#2563eb" stroke="#ffffff" stroke-width="4"/>
  <path d="M24 28h4l2-3h8l2 3h4c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H24c-1.7 0-3-1.3-3-3V31c0-1.7 1.3-3 3-3z" fill="#ffffff"/>
  <circle cx="32" cy="36" r="5" fill="#2563eb"/>
</svg>
`;

const CAMERA_PRIVATE_LOCK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#6b7280" stroke="#ffffff" stroke-width="4"/>
  <path d="M24 28h4l2-3h8l2 3h4c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H24c-1.7 0-3-1.3-3-3V31c0-1.7 1.3-3 3-3z" fill="#ffffff"/>
  <circle cx="32" cy="36" r="5" fill="#6b7280"/>
  <!-- lock badge -->
  <circle cx="44" cy="22" r="9" fill="#111827" stroke="#ffffff" stroke-width="3"/>
  <path d="M41 22v-2.2c0-1.7 1.3-3 3-3s3 1.3 3 3V22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
  <rect x="40" y="22" width="8" height="7" rx="1.5" fill="#ffffff"/>
  <circle cx="44" cy="25.5" r="1" fill="#111827"/>
</svg>
`;

export default function MapView({
  places,
  onRequestNew,
  onSelect,
  selectedId,
  flyTo,
  bindGetView,
  bindSetView,
  initialView,
  mode,
}: {
  places: Place[];
  onRequestNew: (p: { lat: number; lng: number }) => void;
  onSelect?: (p: Place) => void;
  selectedId?: string | null;
  flyTo?: { lat: number; lng: number; zoom?: number; label?: string } | null;
  bindGetView?: (fn: () => View) => void;
  bindSetView?: (fn: (v: View) => void) => void;
  initialView?: View;
  mode?: "private" | "public";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const placesRef = useRef<Place[]>(places);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

 const autoMode = useMemo<"private" | "public">(() => {
  // ✅ 明示指定があれば最優先（publicページだけ星/チェック出したいならこれが必須）
  if (mode) return mode;

  // ✅ 指定が無い場合だけ自動判定
  return (places ?? []).some(isPublicModeCandidate) ? "public" : "private";
}, [mode, places]);

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: places.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          title: p.name ?? "",
          visibility: p.visibility ?? "private",
          wantedByMe: !!p.wantedByMe,
          visitedByMe: !!p.visitedByMe,
        },
      })),
    } as GeoJSON.FeatureCollection;
  }, [places]);

  function applyMode(map: Map, mode: "private" | "public") {
  if (!map.getLayer("pins")) return;

  // ✅ 追加：symbolレイヤー（星/チェック）を表示/非表示切替
  const setSymbolVisible = (id: string, visible: boolean) => {
    if (!map.getLayer(id)) return; // レイヤー無ければ何もしない
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  };

  if (mode === "private") {
    // privateでは星/チェックは出さない
    setSymbolVisible("pin-wanted", false);
    setSymbolVisible("pin-visited", false);

    map.setPaintProperty("pins", "circle-color", [
      "case",
      ["==", ["get", "visibility"], "public"],
      "#2563eb",
      ["==", ["get", "visibility"], "pair"],
      "#eab308",
      "#ef4444",
    ]);
    map.setPaintProperty("pins", "circle-opacity", 1);
  } else {
    // publicでは星/チェックを出す
    setSymbolVisible("pin-wanted", true);
    setSymbolVisible("pin-visited", true);

    map.setPaintProperty("pins", "circle-color", "#2563eb");

    // wanted/visited のピンは丸を消して、星/チェックに置き換える
    map.setPaintProperty("pins", "circle-opacity", [
      "case",
      ["any", ["==", ["get", "wantedByMe"], true], ["==", ["get", "visitedByMe"], true]],
      0,
      1,
    ]);
  }
}


  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [initialView?.lng ?? 139.76, initialView?.lat ?? 35.68],
      zoom: initialView?.zoom ?? 6,
    });

    mapRef.current = map;

    map.on("dblclick", (e) => {
      onRequestNew({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

   map.on("load", async () => {
  await loadSvgAsImage(map, "pin-camera-public", CAMERA_PUBLIC_SVG);
  await loadSvgAsImage(map, "pin-camera-private", CAMERA_PRIVATE_LOCK_SVG);

  // ここから下に layer 定義を置く
});

   // public 投稿
map.addLayer({
  id: "pin-camera-public",
  type: "symbol",
  source: "places",
  filter: ["all",
    ["==", ["get", "visibility"], "public"],
    ["!=", ["get", "visibility"], "pilgrimage"],
  ],
  layout: {
    "icon-image": "pin-camera-public",
    "icon-size": 0.6,
    "icon-allow-overlap": true,
    "icon-anchor": "center",
  },
});

// private 投稿
map.addLayer({
  id: "pin-camera-private",
  type: "symbol",
  source: "places",
  filter: ["all",
    ["==", ["get", "visibility"], "private"],
    ["!=", ["get", "visibility"], "pilgrimage"],
  ],
  layout: {
    "icon-image": "pin-camera-private",
    "icon-size": 0.6,
    "icon-allow-overlap": true,
    "icon-anchor": "center",
  },
});


      // ⭐/✓（public専用）アイコン登録
await addSvgImage(map, "pin-star", STAR_SVG, 2);
await addSvgImage(map, "pin-check", CHECK_SVG, 2);

// ✓ 行った（visitedが優先）
map.addLayer({
  id: "pin-visited",
  type: "symbol",
  source: "places",
  filter: [
    "all",
    ["!=", ["get", "visibility"], "pilgrimage"],
    ["==", ["get", "visitedByMe"], true],
  ],
  layout: {
    "icon-image": "pin-check",
    "icon-size": 0.35,
    "icon-allow-overlap": true,
    "icon-anchor": "center",
  },
});

// ⭐ 行きたい（visitedでも表示する）
map.addLayer({
  id: "pin-wanted",
  type: "symbol",
  source: "places",
  filter: [
    "all",
    ["!=", ["get", "visibility"], "pilgrimage"],
    ["==", ["get", "wantedByMe"], true],
  ],
  layout: {
    "icon-image": "pin-star",
    "icon-size": 0.36,          // ⭐は少し大きめ
    "icon-allow-overlap": true,
    "icon-anchor": "center",
  },
});

// 上に持ってくる
map.moveLayer("pin-wanted");
map.moveLayer("pin-visited");




      // 重なり順（いちばん上）
      map.moveLayer("pin-castle-outline");
      map.moveLayer("pin-castle-filled");

      // ✅ 城クリックは popup禁止、onSelectへ
      const pickPlaceFromFeature = (f: any) => {
        const id = String(f?.properties?.id ?? "");
        return placesRef.current.find((x) => x.id === id) ?? null;
      };

      map.on("click", "pin-castle-outline", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = pickPlaceFromFeature(f);
        if (p) onSelect?.(p);
      });

      map.on("click", "pin-castle-filled", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = pickPlaceFromFeature(f);
        if (p) onSelect?.(p);
      });

      // カーソル
      map.on("mouseenter", "pin-castle-outline", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "pin-castle-outline", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "pin-castle-filled", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "pin-castle-filled", () => (map.getCanvas().style.cursor = ""));

      // 通常ピン選択
      map.on("click", "pins", (e) => {
        const id = e.features?.[0]?.properties?.id;
        const p = placesRef.current.find((x) => x.id === id);
        if (p) onSelect?.(p);
      });

      bindGetView?.(() => {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      });

      bindSetView?.((v) => {
        map.easeTo({ center: [v.lng, v.lat], zoom: v.zoom, duration: 0 });
      });

      applyMode(map, autoMode);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("places") as any;
    if (src) src.setData(geojson);
    applyMode(map, autoMode);
  }, [geojson, autoMode]);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}

