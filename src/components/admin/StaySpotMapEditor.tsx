"use client";

import { useEffect, useRef } from "react";
import maplibregl, { Marker, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export type AdminMapSpot = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  is_published: boolean;
};

type Coordinates = { latitude: number; longitude: number };
const DEFAULT_CENTER: [number, number] = [140.3507, 36.7681];

export default function StaySpotMapEditor({ spots, value, stayCenter, onPick, onSelect }: {
  spots: AdminMapSpot[];
  value: Coordinates | null;
  stayCenter?: Coordinates | null;
  onPick: (coordinates: Coordinates) => void;
  onSelect: (spot: AdminMapSpot) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const draftMarker = useRef<Marker | null>(null);
  const callbacks = useRef({ onPick, onSelect });
  callbacks.current = { onPick, onSelect };

  useEffect(() => {
    if (!container.current || map.current) return;
    const center: [number, number] = stayCenter ? [stayCenter.longitude, stayCenter.latitude] : DEFAULT_CENTER;
    const instance = new maplibregl.Map({
      container: container.current,
      style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
      center,
      zoom: stayCenter ? 13 : 10,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    instance.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-right");
    instance.getCanvas().style.cursor = "crosshair";
    instance.on("click", ({ lngLat }) => callbacks.current.onPick({ latitude: lngLat.lat, longitude: lngLat.lng }));
    map.current = instance;
    return () => {
      markers.current.forEach((marker) => marker.remove());
      draftMarker.current?.remove();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = spots.map((spot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `stay-admin-map-pin${spot.is_published ? "" : " is-hidden"}`;
      button.textContent = "●";
      button.title = `${spot.name}を編集`;
      button.setAttribute("aria-label", `${spot.name}を編集`);
      button.onclick = (event) => { event.stopPropagation(); callbacks.current.onSelect(spot); };
      return new maplibregl.Marker({ element: button, anchor: "bottom" }).setLngLat([spot.longitude, spot.latitude]).addTo(map.current!);
    });
  }, [spots]);

  useEffect(() => {
    if (!map.current) return;
    draftMarker.current?.remove();
    draftMarker.current = null;
    if (!value) return;
    const element = document.createElement("div");
    element.className = "stay-admin-draft-pin";
    element.title = "登録する位置（ドラッグで調整）";
    const marker = new maplibregl.Marker({ element, anchor: "bottom", draggable: true })
      .setLngLat([value.longitude, value.latitude])
      .addTo(map.current);
    marker.on("dragend", () => {
      const position = marker.getLngLat();
      callbacks.current.onPick({ latitude: position.lat, longitude: position.lng });
    });
    draftMarker.current = marker;
    map.current.easeTo({ center: [value.longitude, value.latitude], zoom: Math.max(map.current.getZoom(), 15) });
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    if (!map.current || !stayCenter || value) return;
    map.current.easeTo({ center: [stayCenter.longitude, stayCenter.latitude], zoom: 13 });
  }, [stayCenter?.latitude, stayCenter?.longitude, value]);

  return <div ref={container} className="stay-admin-map" aria-label="スポットを登録・編集する地図" />;
}
