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
  markerType?: "place" | "trip_plan_stop";
  markerLabel?: string | null;
  wantedByMe?: boolean;
  visitedByMe?: boolean;
  status?: "wishlist" | "visited";
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
  <path d="M18 24h8l4-6h12l4 6h8c3 0 6 3 6 6v18c0 3-3 6-6 6H18c-3 0-6-3-6-6V30c0-3 3-6 6-6z"
        fill="#2563eb" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="32" cy="39" r="8" fill="#ffffff"/>
  <circle cx="32" cy="39" r="4.5" fill="#2563eb"/>
</svg>
`;


const CAMERA_PRIVATE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M18 24h8l4-6h12l4 6h8c3 0 6 3 6 6v18c0 3-3 6-6 6H18c-3 0-6-3-6-6V30c0-3 3-6 6-6z"
        fill="#6b7280" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="32" cy="39" r="8" fill="#ffffff"/>
  <circle cx="32" cy="39" r="4.5" fill="#6b7280"/>
</svg>
`;


const LOCK_BADGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <!-- shackle -->
  <path d="M22 30v-6c0-8 6-14 14-14s14 6 14 14v6"
        fill="none" stroke="#fde68a" stroke-width="8" stroke-linecap="round"/>
  <path d="M22 30v-6c0-8 6-14 14-14s14 6 14 14v6"
        fill="none" stroke="#92400e" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
  <!-- body -->
  <rect x="16" y="28" width="40" height="30" rx="8"
        fill="#f59e0b" stroke="#92400e" stroke-width="5"/>
  <rect x="20" y="32" width="32" height="22" rx="6"
        fill="#fcd34d" opacity="0.9"/>
  <!-- keyhole -->
  <circle cx="36" cy="43" r="4" fill="#92400e"/>
  <rect x="34.5" y="46" width="3" height="7" rx="1.5" fill="#92400e"/>
  <!-- highlight -->
  <path d="M24 36c0-5 3-8 8-8" fill="none" stroke="#fff7ed" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
</svg>
`;




// ☆ 行きたい（枠なし）
const STAR_FILLED_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 8l7.8 15.8 17.4 2.6-12.6 12.2 3 17.3-15.6-8.2-15.6 8.2 3-17.3L6.8 26.4l17.4-2.6z"
        fill="#facc15" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
</svg>
`;


// ☆の上に✓ 行った（枠なし）
const VISITED_STAR_CHECK_FILLED_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M32 8l7.8 15.8 17.4 2.6-12.6 12.2 3 17.3-15.6-8.2-15.6 8.2 3-17.3L6.8 26.4l17.4-2.6z"
        fill="#facc15" stroke="#ffffff" stroke-width="4" stroke-linejoin="round"/>
  <path d="M22 35l7 7 16-20"
        fill="none" stroke="#22c55e" stroke-width="8"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const STICKY_NOTE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="10" y="8" width="44" height="44" rx="8" fill="#fef3c7" stroke="#f59e0b" stroke-width="4"/>
  <path d="M42 8h12v12z" fill="#fde68a" stroke="#f59e0b" stroke-width="3"/>
  <circle cx="32" cy="54" r="6" fill="#f59e0b" />
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
  onCenterChange,
  showCenterMarker = false,
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

  onCenterChange?: (c: { lat: number; lng: number }) => void;
  showCenterMarker?: boolean;
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
          markerType: p.markerType ?? "place",
          markerLabel: p.markerLabel ?? "",
          visibility: p.visibility ?? (mode === "public" ? "public" : "private"),
          wantedByMe: !!p.wantedByMe,
          visitedByMe: !!p.visitedByMe,
          status: p.status ?? "visited",
        },
      })),
    } as GeoJSON.FeatureCollection;
  }, [places]);

  function applyMode(map: Map, m: "private" | "public") {
    // ⭐/✓ は public / private どちらでも見せる
    const setSymbolVisible = (id: string, visible: boolean) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    setSymbolVisible("pin-wanted", true);
    setSymbolVisible("pin-visited", true);
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

    const emitCenter = () => {
      const c = map.getCenter();
      onCenterChange?.({ lat: c.lat, lng: c.lng });
    };

    map.on("moveend", emitCenter);

    // 初期値も一回流す（地図開いた直後に center を持てる）
    emitCenter();


    mapRef.current = map;

 map.on("dblclick", (e) => {
  e.preventDefault(); // ダブルタップズームを防ぐ（スマホ事故防止）

  const c = map.getCenter(); // 中央固定
  onRequestNew({ lat: c.lat, lng: c.lng });
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
await loadSvgAsImage(map, "pin-lock", LOCK_BADGE_SVG);

await loadSvgAsImage(map, "pin-star-fill", STAR_FILLED_SVG);
await loadSvgAsImage(map, "pin-star-check-fill", VISITED_STAR_CHECK_FILLED_SVG);
await loadSvgAsImage(map, "pin-sticky-note", STICKY_NOTE_SVG);

      // 3) レイヤー（public📷）
      if (!map.getLayer("pin-camera-public")) {
        map.addLayer({
          id: "pin-camera-public",
          type: "symbol",
          source: "places",
          filter: ["all", ["==", ["get", "visibility"], "public"], ["!=", ["get", "markerType"], "trip_plan_stop"]],

          layout: {
            "icon-image": "pin-camera-public",
            "icon-size": 0.9,
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
          filter: [
            "all",
            ["==", ["get", "visibility"], "private"],
            ["==", ["get", "status"], "visited"],
            ["!=", ["get", "markerType"], "trip_plan_stop"],
          ],
          layout: {
            "icon-image": "pin-camera-private",
            "icon-size": 0.9,
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
    filter: [
      "all",
      ["==", ["get", "visibility"], "private"],
      ["==", ["get", "status"], "visited"],
      ["!=", ["get", "markerType"], "trip_plan_stop"],
    ],
    layout: {
      "icon-image": "pin-lock",
      "icon-size": 0.75,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
      "icon-offset": [1.25, -1.35],
    },
  });
}

// 行った（⭐✓）…最前面
if (!map.getLayer("pin-visited")) {
  map.addLayer({
    id: "pin-visited",
    type: "symbol",
    source: "places",
    filter: ["all", ["==", ["get", "visitedByMe"], true]],
    layout: {
      "icon-image": "pin-star-check-fill",
      "icon-size": 1.15,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
  });
}

// 行きたい（⭐）…visitedのときは出さない
if (!map.getLayer("pin-wanted")) {
  map.addLayer({
    id: "pin-wanted",
    type: "symbol",
    source: "places",
    filter: ["all",
      [
        "any",
        ["==", ["get", "wantedByMe"], true],
        [
          "all",
          ["==", ["get", "visibility"], "private"],
          ["==", ["get", "status"], "wishlist"],
        ],
      ],
      ["!=", ["get", "visitedByMe"], true],
    ],
    layout: {
      "icon-image": "pin-star-fill",
      "icon-size": 1.05,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
    },
  });
}

if (!map.getLayer("pin-trip-plan-stop")) {
  map.addLayer({
    id: "pin-trip-plan-stop",
    type: "symbol",
    source: "places",
    filter: ["==", ["get", "markerType"], "trip_plan_stop"],
    layout: {
      "icon-image": "pin-sticky-note",
      "icon-size": 0.78,
      "icon-allow-overlap": true,
      "icon-anchor": "bottom",
      "text-field": ["get", "markerLabel"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.4],
      "text-max-width": 10,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#92400e",
      "text-halo-color": "#fffbeb",
      "text-halo-width": 1.2,
    },
  });
}


// 下：カメラ → 上：鍵 → 上：星 → 最上：行った
if (map.getLayer("pin-camera-public")) map.moveLayer("pin-camera-public");
if (map.getLayer("pin-camera-private")) map.moveLayer("pin-camera-private");
if (map.getLayer("pin-lock-badge")) map.moveLayer("pin-lock-badge");
if (map.getLayer("pin-wanted")) map.moveLayer("pin-wanted");
if (map.getLayer("pin-visited")) map.moveLayer("pin-visited");
if (map.getLayer("pin-trip-plan-stop")) map.moveLayer("pin-trip-plan-stop");



      // 7) クリック（📷/📷🔒/⭐/✓ 全部同じ挙動にしとく）
      const clickableLayers = ["pin-camera-public", "pin-camera-private", "pin-wanted", "pin-visited", "pin-trip-plan-stop"] as const;
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

   return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* map container（ここにMapLibreが描画される） */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* center camera overlay */}
      {showCenterMarker && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -100%)",
            zIndex: 5,
            pointerEvents: "none",
            fontSize: 28,
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.25))",
          }}
          aria-hidden="true"
        >
          📷
        </div>
      )}
    </div>
  );
}
