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
};

type View = { lat: number; lng: number; zoom: number };

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
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  bindGetView?: (fn: () => View) => void;
  bindSetView?: (fn: (v: View) => void) => void;
  initialView?: View;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  // ★ 最新の places を常に参照するための ref
  const placesRef = useRef<Place[]>(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // GeoJSON へ変換
  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: (places || []).map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { id: p.id, title: p.name ?? "" },
      })),
    } as GeoJSON.FeatureCollection;
  }, [places]);

  // 初期化：OSM ラスタ（キー不要・詳細表示）
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
      attributionControl: true,
    });
    mapRef.current = map;

    // ダブルクリックでその地点に投稿
    map.on("dblclick", (e) => {
      onRequestNew({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    map.on("load", () => {
      // データソース
      map.addSource("places", { type: "geojson", data: geojson });

      // ピン
      map.addLayer({
        id: "visit-pins",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 6,
          "circle-color": "#1d4ed8",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 選択リング（外）
      map.addLayer({
        id: "visit-selected-ring-outer",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 14,
          "circle-color": "rgba(29,78,216,0.12)",
        },
        filter: ["==", ["get", "id"], ""], // 初期非表示
      });

      // 選択リング（内）
      map.addLayer({
        id: "visit-selected-ring-inner",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 9,
          "circle-color": "rgba(29,78,216,0.25)",
        },
        filter: ["==", ["get", "id"], ""],
      });

      // ★ ピンをクリック → 最新の placesRef から探す（古いクロージャ問題の回避）
      map.on("click", "visit-pins", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as any)?.id);

        const latest = placesRef.current; // ここがミソ
        const p = latest.find((x) => x.id === id);

        // 見つからん場合でも最低限座標から生成して渡せるよう保険
        if (p) {
          onSelect?.(p);
        } else if (f.geometry?.type === "Point") {
          const coords = (f.geometry as any).coordinates as [number, number];
          onSelect?.({ id, name: (f.properties as any)?.title ?? "", memo: "", lng: coords[0], lat: coords[1], photos: [] });
        }
      });

      // 視点 getter / setter を親へ
      bindGetView?.(() => {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      });
      bindSetView?.((v) => {
        map.easeTo({ center: [v.lng, v.lat], zoom: v.zoom, duration: 0 });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // データ更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("places") as any;
    if (src) src.setData(geojson);
  }, [geojson]);

  // flyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    map.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? Math.max(map.getZoom(), 12),
      duration: 450,
    });
  }, [flyTo]);

  // 選択リング
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = selectedId ?? "";
    if (map.getLayer("visit-selected-ring-outer")) {
      map.setFilter("visit-selected-ring-outer", ["==", ["get", "id"], target]);
    }
    if (map.getLayer("visit-selected-ring-inner")) {
      map.setFilter("visit-selected-ring-inner", ["==", ["get", "id"], target]);
    }
  }, [selectedId]);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}



