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
  visibility?: "public" | "private" | "pair";
  wantedByMe?: boolean;
  visitedByMe?: boolean;
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
  flyTo?: { lat: number; lng: number; zoom?: number; label?: string } | null;
  bindGetView?: (fn: () => View) => void;
  bindSetView?: (fn: (v: View) => void) => void;
  initialView?: View;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  // 検索一時ピン（HTMLマーカー：これはOK）
  const searchMarkerRef = useRef<Marker | null>(null);

  // 最新 places を参照するための ref
  const placesRef = useRef<Place[]>(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // GeoJSON へ変換（wanted/visited を properties に入れる）
  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: (places || []).map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          title: p.name ?? "",
          wantedByMe: !!p.wantedByMe,
          visitedByMe: !!p.visitedByMe,
          postCount: p.postCount ?? 0,
        },
      })),
    } as GeoJSON.FeatureCollection;
  }, [places]);

  // 初期化：OSM ラスタ
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

    // ダブルクリックでその地点に投稿
    map.on("dblclick", (e) => {
      onRequestNew({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    map.on("load", () => {
      // データソース
      map.addSource("places", { type: "geojson", data: geojson });

      /**
       * ✅ 1) 通常ピンは “青” 固定（色分けやめ）
       * 半径も固定にして見た目安定させる
       */
      map.addLayer({
        id: "pins",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 6.5,
          "circle-color": "#2563eb", // 青固定
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      /**
       * ✅ 2) 行きたい or 行った → ☆を重ねる（同一座標なのでズレない）
       * ※ フォントは環境差が出にくい並びにする
       */
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
          "text-field": "★",
          "text-size": 18,
          "text-font": ["Noto Sans Regular", "Arial Unicode MS Regular", "sans-serif"],
          "text-anchor": "center",
          "text-offset": [0, 0], // ← まずは青ピンに重ねる（希望通り）
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#facc15", // ☆は黄色（見やすい）
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 2,
        },
      });

      /**
       * ✅ 3) 行った → ☆の上に☑（✓）を重ねる
       */
      map.addLayer({
        id: "pin-check",
        type: "symbol",
        source: "places",
        filter: ["==", ["get", "visitedByMe"], true],
        layout: {
          "text-field": "✓",
          "text-size": 12,
          "text-font": ["Noto Sans Regular", "Arial Unicode MS Regular", "sans-serif"],
          "text-anchor": "center",
          "text-offset": [0, 0], // ☆と同じ位置
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#166534",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 2,
        },
      });

      /**
       * ✅ 4) 投稿数ラベル（必要なら残す）
       * 星やチェックと干渉したら offset を変える
       */
      map.addLayer({
        id: "postcount-labels",
        type: "symbol",
        source: "places",
        layout: {
          "text-field": [
            "case",
            [">", ["get", "postCount"], 1],
            ["to-string", ["get", "postCount"]],
            "",
          ],
          "text-size": 12,
          "text-font": ["Noto Sans Regular", "Arial Unicode MS Regular", "sans-serif"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-anchor": "center",
          "text-offset": [0, -1.2], // 上に少し
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.55)",
          "text-halo-width": 2,
        },
      });

      // 選択リング（外）
      map.addLayer({
        id: "selected-ring-outer",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 14,
          "circle-color": "rgba(29,78,216,0.12)",
        },
        filter: ["==", ["get", "id"], ""],
      });

      // 選択リング（内）
      map.addLayer({
        id: "selected-ring-inner",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 9,
          "circle-color": "rgba(29,78,216,0.25)",
        },
        filter: ["==", ["get", "id"], ""],
      });

      /**
       * ✅ レイヤー順を明示（これで「出たり消えたり」しにくい）
       * pins の上に star → check → postcount の順
       */
      if (map.getLayer("pin-star")) map.moveLayer("pin-star");
      if (map.getLayer("pin-check")) map.moveLayer("pin-check");
      if (map.getLayer("postcount-labels")) map.moveLayer("postcount-labels");
      if (map.getLayer("selected-ring-outer")) map.moveLayer("selected-ring-outer");
      if (map.getLayer("selected-ring-inner")) map.moveLayer("selected-ring-inner");

      // ピンをクリック → placesRef から探す
      map.on("click", "pins", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as any)?.id);

        const latest = placesRef.current;
        const p = latest.find((x) => x.id === id);

        if (p) {
          onSelect?.(p);
        } else if (f.geometry?.type === "Point") {
          const coords = (f.geometry as any).coordinates as [number, number];
          onSelect?.({
            id,
            name: (f.properties as any)?.title ?? "",
            memo: "",
            lng: coords[0],
            lat: coords[1],
            photos: [],
          });
        }
      });

      // 視点 getter / setter
      bindGetView?.(() => {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      });
      bindSetView?.((v) => {
        map.easeTo({ center: [v.lng, v.lat], zoom: v.zoom, duration: 0 });
      });
    });

    return () => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // データ更新（GeoJSON差し替え）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const src = map.getSource("places") as any;
    if (src) src.setData(geojson);
  }, [geojson]);

  // 検索ジャンプ（一時ピン）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;

    const targetZoom = flyTo.zoom ?? 17;
    map.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: targetZoom,
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

  // 選択リング更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const target = selectedId ?? "";
    if (map.getLayer("selected-ring-outer")) {
      map.setFilter("selected-ring-outer", ["==", ["get", "id"], target]);
    }
    if (map.getLayer("selected-ring-inner")) {
      map.setFilter("selected-ring-inner", ["==", ["get", "id"], target]);
    }
  }, [selectedId]);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}


