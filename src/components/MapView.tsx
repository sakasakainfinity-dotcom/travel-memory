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
  visibility?: "public" | "private";
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

/* ===== アイコンSVG ===== */
const CAMERA_PUBLIC_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#2563eb" stroke="#ffffff" stroke-width="4"/>
  <path d="M24 28h4l2-3h8l2 3h4c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H24c-1.7 0-3-1.3-3-3V31c0-1.7 1.3-3 3-3z" fill="#ffffff"/>
  <circle cx="32" cy="36" r="5" fill="#2563eb"/>
</svg>
`;

const CAMERA_PRIVATE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#6b7280" stroke="#ffffff" stroke-width="4"/>
  <path d="M24 28h4l2-3h8l2 3h4c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H24c-1.7 0-3-1.3-3-3V31c0-1.7 1.3-3 3-3z" fill="#ffffff"/>
  <circle cx="32" cy="36" r="5" fill="#6b7280"/>
</svg>
`;

const LOCK_BADGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#f59e0b" stroke="#ffffff" stroke-width="4"/>
  <path d="M24 30v-4c0-5.5 4.5-10 10-10s10 4.5 10 10v4"
        fill="none" stroke="#fff7ed" stroke-width="6" stroke-linecap="round"/>
  <path d="M24 30v-4c0-5.5 4.5-10 10-10s10 4.5 10 10v4"
        fill="none" stroke="#92400e" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
  <rect x="20" y="28" width="28" height="22" rx="6"
        fill="#fcd34d" stroke="#92400e" stroke-width="4"/>
  <circle cx="34" cy="39" r="3" fill="#92400e"/>
  <rect x="33" y="42" width="2" height="6" rx="1" fill="#92400e"/>
  <path d="M26 34c0-4 2.5-6.5 6.5-6.5" fill="none" stroke="#fff7ed" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
</svg>
`;



// ☆ 行きたい（枠なし）
const STAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 10l7.2 14.6 16.1 2.3-11.7 11.4 2.8 16-14.4-7.6-14.4 7.6 2.8-16-11.7-11.4 16.1-2.3z"
        fill="none" stroke="#facc15" stroke-width="5" stroke-linejoin="round"/>
</svg>
`;

// ☆の上に✓ 行った（枠なし）
const VISITED_STAR_CHECK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <!-- star outline -->
  <path d="M32 10l7.2 14.6 16.1 2.3-11.7 11.4 2.8 16-14.4-7.6-14.4 7.6 2.8-16-11.7-11.4 16.1-2.3z"
        fill="none" stroke="#facc15" stroke-width="5" stroke-linejoin="round"/>

  <!-- check -->
  <path d="M24 34l6 6 14-18"
        fill="none" stroke="#22c55e" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;


/* ===== MapView ===== */
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
    if (mode) return mode;
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
          visibility: p.visibility ?? (mode === "public" ? "public" : "private"),
          wantedByMe: !!p.wantedByMe,
          visitedByMe: !!p.visitedByMe,
        },
      })),
    } as GeoJSON.FeatureCollection;
  }, [places]);

  function applyMode(map: Map, m: "private" | "public") {
    // publicでだけ⭐/✓を見せる
    const setSymbolVisible = (id: string, visible: boolean) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    if (m === "private") {
      setSymbolVisible("pin-wanted", false);
      setSymbolVisible("pin-visited", false);
    } else {
      setSymbolVisible("pin-wanted", true);
      setSymbolVisible("pin-visited", true);
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

    const pickPlaceFromFeature = (f: any) => {
      const id = String(f?.properties?.id ?? "");
      return placesRef.current.find((x) => x.id === id) ?? null;
    };

    map.on("load", async () => {
      // 1) source 作成（loadの中で！）
      if (!map.getSource("places")) {
        map.addSource("places", {
          type: "geojson",
          data: geojson as any,
        });
      }

      // 2) 画像登録
     await loadSvgAsImage(map, "pin-camera-public", CAMERA_PUBLIC_SVG);
      await loadSvgAsImage(map, "pin-camera-private", CAMERA_PRIVATE_SVG);
      await loadSvgAsImage(map, "pin-lock-badge", LOCK_BADGE_SVG);
      await loadSvgAsImage(map, "pin-star", STAR_SVG);
      await loadSvgAsImage(map, "pin-star-check", VISITED_STAR_CHECK_SVG);

      // 3) レイヤー（public📷）
      if (!map.getLayer("pin-camera-public")) {
        map.addLayer({
          id: "pin-camera-public",
          type: "symbol",
          source: "places",
          filter: [
            "all",
            ["==", ["get", "visibility"], "public"],
            // publicモードで wanted/visited があるときは⭐/✓に置き換えるので📷は隠す
            [
              "!",
              [
                "any",
                ["==", ["get", "wantedByMe"], true],
                ["==", ["get", "visitedByMe"], true],
              ],
            ],
          ],
          layout: {
            "icon-image": "pin-camera-public",
            "icon-size": 1.1,
            "icon-allow-overlap": true,
            "icon-anchor": "center",
          },
        });
      }

      // 4) レイヤー（private📷🔒）
      if (!map.getLayer("pin-camera-private")) {
        map.addLayer({
          id: "pin-camera-private",
          type: "symbol",
          source: "places",
          filter: ["all", ["==", ["get", "visibility"], "private"]],
          layout: {
            "icon-image": "pin-camera-private",
            "icon-size": 1.55,
            "icon-allow-overlap": true,
            "icon-anchor": "center",
          },
        });
      }

      // 🔒 バッジ（privateのときだけ、右上に重ねる）
if (!map.getLayer("pin-lock-badge")) {
  map.addLayer({
    id: "pin-lock-badge",
    type: "symbol",
    source: "places",
    filter: ["all", ["==", ["get", "visibility"], "private"]],
    layout: {
      "icon-image": "pin-lock-badge",
      "icon-size": 1.0,              // ← ここだけ大きくする（後で調整）
      "icon-allow-overlap": true,
      "icon-anchor": "center",
      "icon-offset": [1.0, -1.0],    // 右上へズラす（値は微調整OK）
    },
  });
}

     // 5) publicモード専用（☆の上に✓）
if (!map.getLayer("pin-visited")) {
  map.addLayer({
    id: "pin-visited",
    type: "symbol",
    source: "places",
    filter: ["all", ["==", ["get", "visitedByMe"], true]],
    layout: {
      "icon-image": "pin-star-check",
      "icon-size": 1.4,              // ← 少し大きめ推奨
      "icon-allow-overlap": true,
      "icon-anchor": "center",
    },
  });
}


   // 6) ☆ 行きたい（visitedの時は出さない）
if (!map.getLayer("pin-wanted")) {
  map.addLayer({
    id: "pin-wanted",
    type: "symbol",
    source: "places",
    filter: [
      "all",
      ["==", ["get", "wantedByMe"], true],
      ["!=", ["get", "visitedByMe"], true], // ←これ必須
    ],
    layout: {
      "icon-image": "pin-star",
      "icon-size": 1.4,
      "icon-allow-overlap": true,
      "icon-anchor": "center",
    },
  });
}


      // ⭐より✓を必ず上にする（超重要）
if (map.getLayer("pin-wanted")) {
  map.moveLayer("pin-wanted");
}
if (map.getLayer("pin-visited")) {
  map.moveLayer("pin-visited");
}


      // 7) クリック（📷/📷🔒/⭐/✓ 全部同じ挙動にしとく）
      const clickableLayers = ["pin-camera-public", "pin-camera-private", "pin-wanted", "pin-visited"] as const;
      for (const layerId of clickableLayers) {
        if (!map.getLayer(layerId)) continue;
        map.on("click", layerId, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = pickPlaceFromFeature(f);
          if (p) onSelect?.(p);
        });
        map.on("mouseenter", layerId, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layerId, () => (map.getCanvas().style.cursor = ""));
      }

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

  // flyTo（必要なら）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? map.getZoom(),
      duration: 600,
    });
  }, [flyTo]);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0 }} />;
}
