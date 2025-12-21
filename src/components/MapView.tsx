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

  // private側：色分けに使う
  visibility?: "public" | "private" | "pair" | string;

  // public側：行きたい/行った表示に使う
  wantedByMe?: boolean;
  visitedByMe?: boolean;
};

type View = { lat: number; lng: number; zoom: number };

function hasPublicFlags(p: Place) {
  // publicページ用 places は wantedByMe / visitedByMe が入ってくる想定
  return typeof p.wantedByMe === "boolean" || typeof p.visitedByMe === "boolean";
}

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
  const searchMarkerRef = useRef<Marker | null>(null);
　const flagMarkersRef = useRef<maplibregl.Marker[]>([]);
  
  // 最新 places を参照する ref（クリック時に使う）
  const placesRef = useRef<Place[]>(places);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // ✅ page修正なしでモード自動判定
  // wanted/visited が含まれてるなら public表示ルールにする
  const autoMode = useMemo<"public" | "private">(() => {
    return (places ?? []).some(hasPublicFlags) ? "public" : "private";
  }, [places]);

  // ✅ GeoJSON（visibilityを必ず入れる。これ抜けると全部赤になる）
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

  // 初期化
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const style: any = {
      version: 8,

      // ✅ symbol(text) を出すには glyphs 必須
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",

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

    // ✅ “モード適用”関数（public/private を切り替えても壊れん）
    const applyMode = (mode: "public" | "private") => {
      if (!map.getLayer("pins")) return;

      // pins の色
      if (mode === "private") {
        map.setPaintProperty("pins", "circle-color", [
          "case",
          ["==", ["get", "visibility"], "public"],
          "#2563eb", // 公開=青
          ["==", ["get", "visibility"], "pair"],
          "#eab308", // ペア=黄
          "#ef4444", // private=赤
        ]);
        // privateでは透明化しない
        map.setPaintProperty("pins", "circle-opacity", 1);

        // public用の星/チェックは消す
        if (map.getLayer("pin-star")) map.removeLayer("pin-star");
        if (map.getLayer("pin-check")) map.removeLayer("pin-check");
      } else {
        // publicページは青固定
        map.setPaintProperty("pins", "circle-color", "#2563eb");

        // 行きたい/行った はピンを透明にする
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

        // 星（行きたい or 行った）
        if (!map.getLayer("pin-star")) {
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
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-anchor": "center",
              "text-offset": [0, 0], // ピン中心に重ねる（ズレない）
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#facc15",
              "text-halo-color": "rgba(255,255,255,0.95)",
              "text-halo-width": 2,
            },
          });
        }

        // チェック（行った）
        if (!map.getLayer("pin-check")) {
          map.addLayer({
            id: "pin-check",
            type: "symbol",
            source: "places",
            filter: ["==", ["get", "visitedByMe"], true],
            layout: {
              "text-field": "✓",
              "text-size": 12,
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-anchor": "center",
              "text-offset": [0, 0],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#166534",
              "text-halo-color": "rgba(255,255,255,0.95)",
              "text-halo-width": 2,
            },
          });
        }

        // 順番（pinsの上にstar→check）
        map.moveLayer("pin-star");
        map.moveLayer("pin-check");
      }
    };

    map.on("load", () => {
      // source
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

      // クリック判定は pins で統一（publicでも透明ピンが判定残る）
      map.on("click", "pins", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as any)?.id);

        const latest = placesRef.current;
        const p = latest.find((x) => x.id === id);

        if (p) onSelect?.(p);
      });

      // getter/setter
      bindGetView?.(() => {
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng, zoom: map.getZoom() };
      });
      bindSetView?.((v) => {
        map.easeTo({ center: [v.lng, v.lat], zoom: v.zoom, duration: 0 });
      });

      // ✅ 初回適用（autoMode）
      applyMode(autoMode);
    });

    return () => {
      searchMarkerRef.current?.remove();
      searchMarkerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rebuildFlagMarkers(map: maplibregl.Map, places: Place[]) {
  // 既存を全部削除
  flagMarkersRef.current.forEach((m) => m.remove());
  flagMarkersRef.current = [];

  for (const p of places ?? []) {
    if (!p.wantedByMe && !p.visitedByMe) continue;

    const el = document.createElement("div");
    el.style.width = "26px";
    el.style.height = "26px";
    el.style.pointerEvents = "none";
    el.style.position = "relative";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";

    // ★
    const star = document.createElement("div");
    star.textContent = "★";
    star.style.fontSize = "22px";
    star.style.fontWeight = "900";
    star.style.lineHeight = "1";
    star.style.color = "#facc15";
    star.style.textShadow = "0 0 4px rgba(255,255,255,0.95)";
    el.appendChild(star);

    // ✓（行っただけ）
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

    const m = new maplibregl.Marker({
      element: el,
      anchor: "center",   // ✅ 地点の中心に重ねる
      offset: [0, 0],     // ✅ ズレの原因を作らない
    })
      .setLngLat([p.lng, p.lat])
      .addTo(map);

    flagMarkersRef.current.push(m);
  }
}


  // source更新
  useEffect(() => {
    const map = mapRef.current;
if (!map) return;

if (autoMode === "public") {
  rebuildFlagMarkers(map, placesRef.current);
} else {
  // privateなら消しとく
  flagMarkersRef.current.forEach((m) => m.remove());
  flagMarkersRef.current = [];
}

    const src = map.getSource("places") as any;
    if (src) src.setData(geojson);

    // ✅ placesの内容が変わったら “自動モード” を再適用
    const apply = (mode: "public" | "private") => {
      // load前に呼ばれても落ちんように
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
        if (map.getLayer("pin-star")) map.removeLayer("pin-star");
        if (map.getLayer("pin-check")) map.removeLayer("pin-check");
      } else {
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

        if (!map.getLayer("pin-star")) {
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
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-anchor": "center",
              "text-offset": [0, 0],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#facc15",
              "text-halo-color": "rgba(255,255,255,0.95)",
              "text-halo-width": 2,
            },
          });
        }

        if (!map.getLayer("pin-check")) {
          map.addLayer({
            id: "pin-check",
            type: "symbol",
            source: "places",
            filter: ["==", ["get", "visitedByMe"], true],
            layout: {
              "text-field": "✓",
              "text-size": 12,
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-anchor": "center",
              "text-offset": [0, 0],
              "text-allow-overlap": true,
              "text-ignore-placement": true,
            },
            paint: {
              "text-color": "#166534",
              "text-halo-color": "rgba(255,255,255,0.95)",
              "text-halo-width": 2,
            },
          });
        }

        map.moveLayer("pin-star");
        map.moveLayer("pin-check");
      }
    };

    apply(autoMode);
  }, [geojson, autoMode]);

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

  // ✅ public用の★/✓ DOMマーカーを消す
  flagMarkersRef.current.forEach((m) => m.remove());
  flagMarkersRef.current = [];
} else {
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

  // ✅ ★/✓ をDOMで重ねる（ズレない）
  rebuildFlagMarkers(map, placesRef.current);
}
  
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

  // 選択リング（※必要ならここで追加実装。今は省略しても動く）
  // selectedId を使ったリングが必要なら、あなたの元コードのまま移植してOK

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}
