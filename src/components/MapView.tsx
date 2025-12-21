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

/**
 * ✅ 丸ピン（circle layer）の半径を Place の状態と同じルールで返す
 * ここは map.addLayer の "circle-radius" と必ず一致させる
 */
function circleRadiusForPlace(p: Place) {
  if (p.visitedByMe) return 7.5;
  if (p.wantedByMe) return 7;
  return 6;
}

/**
 * ✅ “丸ピンの真上”に置くためのYオフセットを計算（px）
 * anchor を "center" にする前提で、座標＝要素の中心
 */
function calcBadgeOffsetY(circleRadius: number, badgeSize: number, gap: number) {
  const badgeHalf = badgeSize / 2;
  return -(circleRadius + gap + badgeHalf);
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
          "text-offset": [0, -1.2], // ピンの上に少し浮かす（symbol側）
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

  /**
   * ✅ フラグ（★/✓）のオフセットを「丸ピンの真上」に揃える
   * - anchor:"center" 前提で、座標＝要素中心
   * - 要素の data-radius を読んで個別にオフセット計算
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const BADGE_SIZE = 26; // el の幅/高さと一致させる
    const GAP = 6; // 丸ピンからちょい浮かす量（好みで4〜10）

    function updateFlagOffsets() {
      for (const m of flagMarkersRef.current) {
        const el = m.getElement() as HTMLElement;
        const r = Number(el.dataset.circleRadius ?? "6");
        const y = calcBadgeOffsetY(r, BADGE_SIZE, GAP);
        m.setOffset([0, y]);
      }
    }

    // 初回
    updateFlagOffsets();

    // ズーム等で微妙にズレたのも常に補正（B方式）
    map.on("zoom", updateFlagOffsets);
    map.on("zoomend", updateFlagOffsets);

    return () => {
      map.off("zoom", updateFlagOffsets);
      map.off("zoomend", updateFlagOffsets);
    };
  }, [places]);

  // 行きたい／行ったの「デカ星バッジ」マーカーを更新
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 既存のフラグマーカーを全部削除
    flagMarkersRef.current.forEach((m) => m.remove());
    flagMarkersRef.current = [];

    const BADGE_SIZE = 26;
    const GAP = 6;

    for (const p of places ?? []) {
      if (!p.wantedByMe && !p.visitedByMe) continue;

      // 丸ピン半径（circle layer と同じルール）
      const circleR = circleRadiusForPlace(p);

      const el = document.createElement("div");
      el.style.position = "relative";
      el.style.width = `${BADGE_SIZE}px`;
      el.style.height = `${BADGE_SIZE}px`;
      el.style.pointerEvents = "none";
      // ✅ 後で updateFlagOffsets が読む
      el.dataset.circleRadius = String(circleR);

      // ★ 土台の星
      const star = document.createElement("div");
      star.textContent = "★";
      star.style.position = "absolute";
      star.style.inset = "0";
      star.style.display = "flex";
      star.style.alignItems = "center";
      star.style.justifyContent = "center";
      star.style.fontSize = "24px";
      star.style.fontWeight = "900";
      star.style.lineHeight = "1";
      star.style.color = p.visitedByMe ? "#f59e0b" : "#facc15";
      star.style.textShadow = "0 0 4px rgba(255,255,255,0.9)";
      el.appendChild(star);

      // ✅ 行った場合だけ真ん中にチェック
      if (p.visitedByMe) {
        const check = document.createElement("div");
        check.textContent = "✓";
        check.style.position = "absolute";
        check.style.inset = "0";
        check.style.display = "flex";
        check.style.alignItems = "center";
        check.style.justifyContent = "center";
        check.style.fontSize = "14px";
        check.style.fontWeight = "900";
        check.style.lineHeight = "1";
        check.style.color = "#166534";
        check.style.textShadow = "0 0 3px rgba(255,255,255,0.95)";
        el.appendChild(check);
      }

      // ✅ ここが本命：anchor を "center" にして、常に“丸ピン中心”基準で上に出す
      const y = calcBadgeOffsetY(circleR, BADGE_SIZE, GAP);

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        offset: [0, y],
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



