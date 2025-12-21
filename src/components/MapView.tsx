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

  // 検索一時ピン
  const searchMarkerRef = useRef<Marker | null>(null);

  // 最新 places を参照するための ref
  const placesRef = useRef<Place[]>(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // GeoJSON へ変換（wantedByMe / visitedByMe も含める）
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

      // ★ 丸ピン：行きたい（黄） / 行った（緑） / visibility で色分け
      map.addLayer({
        id: "visit-pins",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "visitedByMe"], true],
            7.5, // 行った → ちょい大きめ
            ["==", ["get", "wantedByMe"], true],
            7, // 行きたい → ちょい大きめ
            6, // その他
          ],
          "circle-color": [
            "case",
            ["==", ["get", "visitedByMe"], true],
            "#22c55e", // visited → 緑
            ["==", ["get", "wantedByMe"], true],
            "#facc15", // wanted → 黄
            ["==", ["get", "visibility"], "public"],
            "#2563eb", // 公開：青
            ["==", ["get", "visibility"], "pair"],
            "#eab308", // ペア：黄
            "#ef4444", // private：赤
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // ✅ 星（wanted or visited のとき、丸ピン中心に重ねる：ズームしてもズレない）
      map.addLayer({
        id: "place-star",
        type: "symbol",
        source: "places",
        layout: {
          "text-field": [
            "case",
            [
              "any",
              ["==", ["get", "wantedByMe"], true],
              ["==", ["get", "visitedByMe"], true],
            ],
            "★",
            "",
          ],
          "text-size": 18,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-anchor": "center",
          "text-offset": [0, 0], // ✅ 丸ピンの中心に固定（重なってOK）
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": [
            "case",
            ["==", ["get", "visitedByMe"], true],
            "#f59e0b", // visited の星（オレンジ寄り）
            "#facc15", // wanted の星（黄色）
          ],
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 2,
        },
      });

      // ✅ チェック（visited のときだけ、星の上に重ねる）
      map.addLayer({
        id: "place-check",
        type: "symbol",
        source: "places",
        layout: {
          "text-field": ["case", ["==", ["get", "visitedByMe"], true], "✓", ""],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-anchor": "center",
          "text-offset": [0, 0], // ✅ 星と同じ中心
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#166534",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 2,
        },
      });

      // ★ 投稿数（postCount）を表示するテキストレイヤー
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
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-offset": [0, -1.2], // ピンの上に少し浮かす（相対。ズームでズレにくい）
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.55)",
          "text-halo-width": 2,
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
        filter: ["==", ["get", "id"], ""],
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

      // レイヤー順の保険（星/✓ を必ず上に）
      if (map.getLayer("place-star")) map.moveLayer("place-star");
      if (map.getLayer("place-check")) map.moveLayer("place-check");
      if (map.getLayer("postcount-labels")) map.moveLayer("postcount-labels");

      // ピンをクリック → 最新の placesRef から探す
      map.on("click", "visit-pins", (e) => {
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
      // 片付け
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // データ更新（ピン位置＆色）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("places") as any;
    if (src) src.setData(geojson);
  }, [geojson]);

  // 検索ジャンプ（一時ピン付き）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;

    const targetZoom = flyTo.zoom ?? 17;
    map.easeTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: targetZoom,
      duration: 600,
    });

    // 既存の検索ピンを消してから新規追加
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

    const t = window.setTimeout(() => {
      marker.togglePopup();
    }, 650);

    return () => window.clearTimeout(t);
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


