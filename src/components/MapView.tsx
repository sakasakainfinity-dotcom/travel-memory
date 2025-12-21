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

  // private側
  visibility?: "public" | "private" | "pair" | string;

  // public側
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

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        map.addImage(name, img, { pixelRatio });
        resolve();
      } catch (e) {
        // すでに追加済み等
        resolve();
      }
    };
    img.onerror = () => reject(new Error(`Failed to load SVG image: ${name}`));
    img.src = svgToDataUrl(svg);
  });
}

export default function MapView({
  places,
  onRequestNew,
  onSelect,
  selectedId, // 使わなくてもOK（既存互換）
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
  const searchMarkerRef = useRef<Marker | null>(null);

  const placesRef = useRef<Place[]>(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // pageを直さず自動判定：wanted/visited が含まれてたら public 表示ルール
  const autoMode = useMemo<"private" | "public">(() => {
    return (places ?? []).some(isPublicModeCandidate) ? "public" : "private";
  }, [places]);

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: (places || []).map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          title: p.name ?? "",
          visibility: p.visibility ?? "private",
          wantedByMe: !!p.wantedByMe,
          visitedByMe: !!p.visitedByMe,
          postCount: p.postCount ?? 0,
        },
      })),
    } as GeoJSON.FeatureCollection;
  }, [places]);

  // mode適用（pinsの色/透明、星/チェックの表示）
  function applyMode(map: Map, mode: "private" | "public") {
    if (!map.getLayer("pins")) return;

    if (mode === "private") {
      map.setPaintProperty("pins", "circle-color", [
        "case",
        ["==", ["get", "visibility"], "public"],
        "#2563eb", // 公開=青
        ["==", ["get", "visibility"], "pair"],
        "#eab308", // ペア=黄
        "#ef4444", // private=赤
      ]);
      map.setPaintProperty("pins", "circle-opacity", 1);

      // public用の星/チェックは非表示に
      if (map.getLayer("pin-star")) map.setLayoutProperty("pin-star", "visibility", "none");
      if (map.getLayer("pin-check")) map.setLayoutProperty("pin-check", "visibility", "none");
    } else {
      // public：通常青、wanted/visited は透明
      map.setPaintProperty("pins", "circle-color", "#2563eb");
      map.setPaintProperty("pins", "circle-opacity", [
        "case",
        [
          "any",
          ["==", ["get", "wantedByMe"], true],
          ["==", ["get", "visitedByMe"], true],
        ],
        0,
        1,
      ]);

      // 星/チェック表示
      if (map.getLayer("pin-star")) map.setLayoutProperty("pin-star", "visibility", "visible");
      if (map.getLayer("pin-check")) map.setLayoutProperty("pin-check", "visibility", "visible");
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const style: any = {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    };

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [initialView?.lng ?? 139.76, initialView?.lat ?? 35.68],
      zoom: initialView?.zoom ?? 9,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("dblclick", (e) => {
      onRequestNew({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    map.on("load", async () => {
      // 1) source
      map.addSource("places", { type: "geojson", data: geojson });

      // 2) pins
      map.addLayer({
        id: "pins",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 6.5,
          "circle-color": "#2563eb",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": 1,
        },
      });

      // 3) ★ / ✓ のSVGアイコン登録（フォント不要）
      const STAR_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
          <path d="M32 4l8.2 16.7 18.4 2.7-13.3 13 3.1 18.3L32 46.9 15.6 54.7l3.1-18.3L5.4 23.4l18.4-2.7L32 4z"
                fill="#facc15" stroke="#ffffff" stroke-width="4" />
        </svg>
      `.trim();

      const CHECK_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
          <path d="M18 34l9 9 19-22" fill="none" stroke="#166534" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 34l9 9 19-22" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `.trim();

      await addSvgImage(map, "star-icon", STAR_SVG, 2);
      await addSvgImage(map, "check-icon", CHECK_SVG, 2);

      // 4) ★レイヤー（wanted or visited）
      map.addLayer({
        id: "pin-star",
        type: "symbol",
        source: "places",
        filter: [
          "any",
          ["==", ["get", "wantedByMe"], true],
          ["==", ["get", "visitedByMe"], true],
        ],
        layout: {
          "icon-image": "star-icon",
          "icon-size": 0.45, // サイズ調整（必要なら 0.35〜0.6）
          "icon-anchor": "center",
          "icon-offset": [0, 0],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // 5) ✓レイヤー（visited）
      map.addLayer({
        id: "pin-check",
        type: "symbol",
        source: "places",
        filter: ["==", ["get", "visitedByMe"], true],
        layout: {
          "icon-image": "check-icon",
          "icon-size": 0.45,
          "icon-anchor": "center",
          "icon-offset": [0, 0],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      // 順番：pinsの上に★、その上に✓
      map.moveLayer("pin-star");
      map.moveLayer("pin-check");

      // クリックは pins で取る（透明でも判定残る）
      map.on("click", "pins", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as any)?.id);
        const p = placesRef.current.find((x) => x.id === id);
        if (p) onSelect?.(p);
      });

      // view getter/setter
      bindGetView?.(() => {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      });
      bindSetView?.((v) => {
        map.easeTo({ center: [v.lng, v.lat], zoom: v.zoom, duration: 0 });
      });

      // 初回適用
      applyMode(map, autoMode);
    });

    return () => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // データ更新（GeoJSON差し替え + mode適用）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const src = map.getSource("places") as any;
    if (src) src.setData(geojson);

    applyMode(map, autoMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geojson, autoMode]);

  // 検索ジャンプ（一時ピン）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;

    map.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 17,
      duration: 600,
    });

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }

    const popup = new maplibregl.Popup({ offset: 12 }).setText(flyTo.label ?? "検索地点");
    const marker = new maplibregl.Marker({ color: "#E11D48" })
      .setLngLat([flyTo.lng, flyTo.lat])
      .setPopup(popup)
      .addTo(map);

    searchMarkerRef.current = marker;

    const t = window.setTimeout(() => marker.togglePopup(), 650);
    return () => window.clearTimeout(t);
  }, [flyTo]);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}
