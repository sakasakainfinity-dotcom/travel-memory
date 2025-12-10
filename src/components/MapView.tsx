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
  visibility?: "public" | "private" | "pair";
  // ★ 行きたい・行ったフラグ（public 用）
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
  // 行きたい／行ったのアイコン用マーカー
  const flagMarkersRef = useRef<Marker[]>([]);

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

      // ★ ピン：行きたい（緑） / 行った（黄） / visibility で色分け
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
            // ✅ 行った！（visited）→ 緑色
            ["==", ["get", "visitedByMe"], true],
             "#22c55e", // green-500
            // ✅ 行きたい！（wanted）→ 黄色
            ["==", ["get", "wantedByMe"], true],
            "#facc15", // yellow-400
            // それ以外は visibility で振り分け
            ["==", ["get", "visibility"], "public"],
            "#2563eb", // 公開：青
            ["==", ["get", "visibility"], "pair"],
            "#eab308", // ペア：黄
            "#ef4444", // 非公開 / private：赤
          ],
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
      flagMarkersRef.current.forEach((m) => m.remove());
      flagMarkersRef.current = [];
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

    // 行きたい／行ったの「デカ星バッジ」マーカーを更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 既存のフラグマーカーを全部削除
    flagMarkersRef.current.forEach((m) => m.remove());
    flagMarkersRef.current = [];

    for (const p of places ?? []) {
      // 両方 false ならバッジなし
      if (!p.wantedByMe && !p.visitedByMe) continue;

      const el = document.createElement("div");
      el.style.position = "relative";
      el.style.width = "30px";
      el.style.height = "30px";
      el.style.pointerEvents = "none"; // マップ操作の邪魔をしない

      // ★ 土台の星
      const star = document.createElement("div");
      star.textContent = "★";
      star.style.position = "absolute";
      star.style.inset = "0";
      star.style.display = "flex";
      star.style.alignItems = "center";
      star.style.justifyContent = "center";
      star.style.fontSize = "26px";
      star.style.fontWeight = "900";
      // 行きたい / 行った どっちも金色だけど、行ったは少し濃いめ
      star.style.color = p.visitedByMe ? "#f59e0b" : "#facc15";
      star.style.textShadow = "0 0 4px rgba(255,255,255,0.9)";

      el.appendChild(star);

      // ✅ 行った場合だけ、真ん中にチェック or 「済」を重ねる
      if (p.visitedByMe) {
        const check = document.createElement("div");
        check.textContent = "✓"; // 「済」がよければここを "済" に
        check.style.position = "absolute";
        check.style.inset = "0";
        check.style.display = "flex";
        check.style.alignItems = "center";
        check.style.justifyContent = "center";
        check.style.fontSize = "14px";
        check.style.fontWeight = "900";
        check.style.color = "#166534"; // 濃い緑
        check.style.textShadow = "0 0 3px rgba(255,255,255,0.95)";
        el.appendChild(check);
      }

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        // ピンの中心にかぶさる感じにしたいので、少しだけ下げる
        offset: [0, -4],
      })
        .setLngLat([p.lng, p.lat])
        .addTo(map);

      flagMarkersRef.current.push(marker);
    }
  }, [places]);

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

    const popup = new maplibregl.Popup({ offset: 12 }).setText(
      flyTo.label ?? "検索地点"
    );
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

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
    />
  );
}

