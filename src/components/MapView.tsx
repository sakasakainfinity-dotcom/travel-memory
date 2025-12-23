// src/components/MapView.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map, Marker } from "maplibre-gl";
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

async function addSvgImage(map: Map, name: string, svg: string, pixelRatio = 2) {
  if (map.hasImage(name)) return;
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        map.addImage(name, img, { pixelRatio });
      } catch {}
      resolve();
    };
    img.src = svgToDataUrl(svg);
  });
}

// 🏯 城アイコン
const CASTLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M8 56h48v-6H8v6zm4-8h40V22l-6-4v-6h-6v6l-8-4-8 4v-6h-6v6l-6 4v26z"
        fill="#0f766e" stroke="#ffffff" stroke-width="2"/>
</svg>
`.trim();

export default function MapView({
  places,
  onRequestNew,
  onSelect,
  selectedId,
  flyTo,
  bindGetView,
  bindSetView,
  initialView,
}: {
  places: Place[];
  onRequestNew: (p: { lat: number; lng: number }) => void;
  onSelect?: (p: Place) => void;
  selectedId?: string | null;
  flyTo?: { lat: number; lng: number; zoom?: number; label?: string } | null;
  bindGetView?: (fn: () => View) => void;
  bindSetView?: (fn: (v: View) => void) => void;
  initialView?: View;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const placesRef = useRef<Place[]>(places);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  const autoMode = useMemo<"private" | "public">(() => {
    return (places ?? []).some(isPublicModeCandidate) ? "public" : "private";
  }, [places]);

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

    if (mode === "private") {
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
      map.setPaintProperty("pins", "circle-color", "#2563eb");
      map.setPaintProperty("pins", "circle-opacity", [
        "case",
        ["any",
          ["==", ["get", "wantedByMe"], true],
          ["==", ["get", "visitedByMe"], true]
        ],
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
      map.addSource("places", { type: "geojson", data: geojson });

      // 通常ピン
      map.addLayer({
        id: "pins",
        type: "circle",
        source: "places",
        filter: ["!=", ["get", "visibility"], "pilgrimage"],
        paint: {
          "circle-radius": 6.5,
          "circle-color": "#2563eb",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 🏯 巡礼ピン
      await addSvgImage(map, "castle-icon", CASTLE_SVG, 2);

      map.addLayer({
        id: "pin-castle",
        type: "symbol",
        source: "places",
        filter: ["==", ["get", "visibility"], "pilgrimage"],
        layout: {
          "icon-image": "castle-icon",
          "icon-size": 0.7,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
      });

      // 通常ピン選択
      map.on("click", "pins", (e) => {
        const id = e.features?.[0]?.properties?.id;
        const p = placesRef.current.find((x) => x.id === id);
        if (p) onSelect?.(p);
      });

      // 🏯クリック → タイトル表示
      map.on("click", "pin-castle", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        new maplibregl.Popup({ offset: 12 })
          .setLngLat((f.geometry as any).coordinates)
          .setText(f.properties?.title ?? "")
          .addTo(map);
      });

      map.on("mouseenter", "pin-castle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "pin-castle", () => {
        map.getCanvas().style.cursor = "";
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

