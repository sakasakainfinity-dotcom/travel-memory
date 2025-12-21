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

  // private側で使う
  visibility?: "public" | "private" | "pair" | string;

  // public側で使う
  wantedByMe?: boolean;
  visitedByMe?: boolean;
};

type View = { lat: number; lng: number; zoom: number };

function isPublicModeCandidate(p: Place) {
  // wanted/visited が boolean で来てる（or どっちかが存在する）なら public表示ルールにする
  return typeof p.wantedByMe === "boolean" || typeof p.visitedByMe === "boolean";
}

export default function MapView({
  places,
  onRequestNew,
  onSelect,
  selectedId, // ※使ってなくてもOK（既存props維持）
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

  // ★/✓ DOMマーカー（publicモード時だけ使う）
  const flagMarkersRef = useRef<Marker[]>([]);

  // 最新 places を参照する ref（クリック時に使う）
  const placesRef = useRef<Place[]>(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // pageを直さず自動判定：wanted/visited が含まれてたら public 表示ルール
  const autoMode = useMemo<"private" | "public">(() => {
    return (places ?? []).some(isPublicModeCandidate) ? "public" : "private";
  }, [places]);

  // GeoJSON（visibility/wanted/visited を必ず入れる）
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

  // ★/✓ DOMマーカーを作り直す（publicモード用）
  function rebuildFlagMarkers(map: Map, rows: Place[]) {
    // 既存削除
    flagMarkersRef.current.forEach((m) => m.remove());
    flagMarkersRef.current = [];

    for (const p of rows ?? []) {
      if (!p.wantedByMe && !p.visitedByMe) continue;

      const el = document.createElement("div");
      el.style.width = "26px";
      el.style.height = "26px";
      el.style.pointerEvents = "none";
      el.style.position = "relative";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";

      const star = document.createElement("div");
      star.textContent = "★";
      star.style.fontSize = "22px";
      star.style.fontWeight = "900";
      star.style.lineHeight = "1";
      star.style.color = "#facc15";
      star.style.textShadow = "0 0 4px rgba(255,255,255,0.95)";
      el.appendChild(star);

      if (p.visitedByMe) {
        const check = document.createElement("div");
        check.textContent = "✓";
        check.style.position = "absolute";
        check.style.inset = "0";
        check.style.display = "flex";
        check.style.alignItems = "center";
        check.style.justifyContent = "center";
        check.style.fontSize = "12px";
        check.style.fontWeight = "900";
        check.style.lineHeight = "1";
        check.style.color = "#166534";
        check.style.textShadow = "0 0 3px rgba(255,255,255,0.95)";
        el.appendChild(check);
      }

      // ✅ ズレない：中心に重ねる／offset 0
      const m = new maplibregl.Marker({
        element: el,
        anchor: "center",
        offset: [0, 0],
      })
        .setLngLat([p.lng, p.lat])
        .addTo(map);

      flagMarkersRef.current.push(m);
    }
  }

  // pins の表示ルールを適用（public/private）
  function applyMode(map: Map, mode: "private" | "public") {
    if (!map.getLayer("pins")) return;

    if (mode === "private") {
      // 色分け（public=青 / pair=黄 / private=赤）
      map.setPaintProperty("pins", "circle-color", [
        "case",
        ["==", ["get", "visibility"], "public"],
        "#2563eb",
        ["==", ["get", "visibility"], "pair"],
        "#eab308",
        "#ef4444",
      ]);
      map.setPaintProperty("pins", "circle-opacity", 1);

      // public用★/✓を消す
      flagMarkersRef.current.forEach((m) => m.remove());
      flagMarkersRef.current = [];
    } else {
      // publicは青固定
      map.setPaintProperty("pins", "circle-color", "#2563eb");

      // wanted/visited はピンを透明にする
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

      // ★/✓ を DOM で重ねる（確実に出る）
      rebuildFlagMarkers(map, placesRef.current);
    }
  }

  // 初期化
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

    // ダブルクリックで新規作成
    map.on("dblclick", (e) => {
      onRequestNew({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    map.on("load", () => {
      map.addSource("places", { type: "geojson", data: geojson });

      // pins（共通）
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

      // クリック：pinsから id 取って placesRef で探す
      map.on("click", "pins", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as any)?.id);

        const latest = placesRef.current;
        const p = latest.find((x) => x.id === id);
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
      // ★/✓掃除
      flagMarkersRef.current.forEach((m) => m.remove());
      flagMarkersRef.current = [];

      // 検索ピン掃除
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // データ更新（GeoJSON差し替え + ルール再適用）
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

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}
