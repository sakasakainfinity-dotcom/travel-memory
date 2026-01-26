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

/* ===== アイコンSVG ===== */
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
  <circle cx="44" cy="22" r="9" fill="#111827" stroke="#ffffff" stroke-width="3"/>
  <path d="M41 22v-2.2c0-1.7 1.3-3 3-3s3 1.3 3 3V22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
  <rect x="40" y="22" width="8" height="7" rx="1.5" fill="#ffffff"/>
  <circle cx="44" cy="25.5" r="1" fill="#111827"/>
</svg>
`;

// publicモード用（行きたい/行った）
const STAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#2563eb" stroke="#ffffff" stroke-width="4"/>
  <path d="M32 18l4.2 8.6 9.5 1.4-6.9 6.7 1.6 9.4-8.4-4.4-8.4 4.4 1.6-9.4-6.9-6.7 9.5-1.4z"
        fill="#ffffff"/>
</svg>
`;

const CHECK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="22" fill="#2563eb" stroke="#ffffff" stroke-width="4"/>
  <path d="M26 34l4 4 10-12" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
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
          visibility: p.visibility ?? "private",
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
      await loadSvgAsImage(map, "pin-camera-private", CAMERA_PRIVATE_LOCK_SVG);
      await loadSvgAsImage(map, "pin-star", STAR_SVG);
      await loadSvgAsImage(map, "pin-check", CHECK_SVG);

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
            "icon-size": 0.6,
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
            "icon-size": 0.6,
            "icon-allow-overlap": true,
            "icon-anchor": "center",
          },
        });
      }

      // 5) publicモード専用（✓ 行ったが優先）
      if (!map.getLayer("pin-visited")) {
        map.addLayer({
          id: "pin-visited",
          type: "symbol",
          source: "places",
          filter: ["all", ["==", ["get", "visitedByMe"], true]],
          layout: {
            "icon-image": "pin-check",
            "icon-size": 0.55,
            "icon-allow-overlap": true,
            "icon-anchor": "center",
          },
        });
      }

      // 6) ⭐ 行きたい
      if (!map.getLayer("pin-wanted")) {
        map.addLayer({
          id: "pin-wanted",
          type: "symbol",
          source: "places",
          filter: ["all", ["==", ["get", "wantedByMe"], true]],
          layout: {
            "icon-image": "pin-star",
            "icon-size": 0.56,
            "icon-allow-overlap": true,
            "icon-anchor": "center",
          },
        });
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
