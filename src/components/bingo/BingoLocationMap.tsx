"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type BingoMapSpot = { id: string; title: string; latitude: number; longitude: number };

const DAIGO_CENTER: [number, number] = [140.3507, 36.7681];

export default function BingoLocationMap({ spots = [], value, onChange, editable = false }: {
  spots?: BingoMapSpot[];
  value?: { latitude: number; longitude: number } | null;
  onChange?: (value: { latitude: number; longitude: number }) => void;
  editable?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const markers = useRef<Marker[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
      center: value ? [value.longitude, value.latitude] : DAIGO_CENTER,
      zoom: value ? 15 : 11,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    if (editable) {
      instance.getCanvas().style.cursor = "crosshair";
      instance.on("click", ({ lngLat }) => onChangeRef.current?.({ latitude: lngLat.lat, longitude: lngLat.lng }));
    }
    map.current = instance;
    return () => { markers.current.forEach((marker) => marker.remove()); instance.remove(); map.current = null; };
  }, [editable]);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    if (editable && value) {
      markers.current.push(new maplibregl.Marker({ color: "#e76f45" }).setLngLat([value.longitude, value.latitude]).addTo(map.current));
      map.current.easeTo({ center: [value.longitude, value.latitude] });
    } else {
      markers.current = spots.map((spot) => new maplibregl.Marker({ color: "#2f765e" })
        .setLngLat([spot.longitude, spot.latitude])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<strong>${escapeHtml(spot.title)}</strong><br><span class="bingo-map-clear">CLEAR ✓</span>`))
        .addTo(map.current!));
      if (spots.length > 1) {
        const bounds = spots.reduce((box, spot) => box.extend([spot.longitude, spot.latitude]), new maplibregl.LngLatBounds([spots[0].longitude, spots[0].latitude], [spots[0].longitude, spots[0].latitude]));
        map.current.fitBounds(bounds, { padding: 54, maxZoom: 15 });
      } else if (spots.length === 1) map.current.easeTo({ center: [spots[0].longitude, spots[0].latitude], zoom: 15 });
    }
  }, [editable, spots, value]);

  return <div ref={container} className="bingo-location-map" aria-label={editable ? "正解地点を設定する地図" : "発見済みスポットの地図"}/>;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}
