"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Marker, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StayMap, StaySpot } from "@/lib/stayMaps";
import { distanceKm } from "@/lib/stayMaps";

const FALLBACK_IMAGE = "/motomachi.jpg";

export default function StayMapClient({ stay }: { stay: StayMap }) {
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<StaySpot | null>(null);
  const container = useRef<HTMLDivElement>(null); const map = useRef<MapLibreMap | null>(null); const markers = useRef<Marker[]>([]);
  const categories = useMemo(() => Array.from(new Map(stay.spots.flatMap(spot => spot.categories).map(item => [item.id, item])).values()), [stay.spots]);
  const spots = useMemo(() => category === "all" ? stay.spots : stay.spots.filter(spot => spot.categories.some(item => item.id === category)), [category, stay.spots]);

  useEffect(() => { void track("map_view", stay.id); }, [stay.id]);
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] }, center: [stay.longitude ?? 140.3507, stay.latitude ?? 36.7681], zoom: 12 });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right"); map.current = instance;
    return () => { markers.current.forEach(marker => marker.remove()); instance.remove(); map.current = null; };
  }, [stay.latitude, stay.longitude]);
  useEffect(() => {
    if (!map.current) return; markers.current.forEach(marker => marker.remove());
    markers.current = spots.map((spot, index) => {
      const button = document.createElement("button"); button.className = `stay-map-pin${spot.is_featured ? " is-featured" : ""}`; button.textContent = String(index + 1); button.title = spot.name;
      button.onclick = () => { setSelected(spot); void track("spot_view", stay.id, spot.id); };
      return new maplibregl.Marker({ element: button, anchor: "bottom" }).setLngLat([spot.longitude, spot.latitude]).addTo(map.current!);
    });
    const points = [...spots.map(spot => [spot.longitude, spot.latitude] as [number, number])]; if (stay.latitude != null && stay.longitude != null) points.push([stay.longitude, stay.latitude]);
    if (points.length) { const bounds = points.slice(1).reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(points[0], points[0])); map.current.fitBounds(bounds, { padding: 48, maxZoom: 15 }); }
  }, [spots, stay.id, stay.latitude, stay.longitude]);

  const openSpot = (spot: StaySpot) => { setSelected(spot); void track("spot_view", stay.id, spot.id); };
  return <main className="stay-map-page">
    <section className="stay-map-content">
      <div ref={container} className="stay-map-canvas" aria-label={`${stay.name}周辺のおすすめ地図`}/>
      <nav className="stay-map-filters" aria-label="カテゴリ絞り込み"><button aria-pressed={category === "all"} onClick={() => setCategory("all")}>すべて</button>{categories.map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.name}</button>)}</nav>
      <div className="stay-spot-list">{spots.map((spot, index) => <article className="stay-spot-card" key={spot.id} onClick={() => openSpot(spot)}>
        <button className="stay-card-main" aria-label={`${spot.name}の詳細を見る`}><div className="stay-card-image"><img src={spot.image_url || FALLBACK_IMAGE} alt={spot.name}/><span>{index + 1}</span>{spot.is_featured && <b>★ 宿主おすすめ</b>}</div><div className="stay-card-copy"><small>{spot.categories.map(item => item.name).join(" · ") || "おすすめ"}</small><h3>{spot.name}</h3><p><em>宿主のひとこと</em>{spot.host_comment}</p><div>{travelLabel(stay, spot)}</div></div></button>
        <a href={mapsUrl(spot)} target="_blank" rel="noreferrer" onClick={event => { event.stopPropagation(); void track("google_maps_click", stay.id, spot.id); }}>Google Mapsで開く ↗</a>
      </article>)}</div>
      {!spots.length && <p className="stay-map-empty">宿主おすすめのスポットを準備しています。公開まで少しお待ちください。</p>}
    </section>
    {selected && <SpotDetail stay={stay} spot={selected} onClose={() => setSelected(null)}/>} 
  </main>;
}

function SpotDetail({ stay, spot, onClose }: { stay: StayMap; spot: StaySpot; onClose: () => void }) {
  return <div className="stay-detail-backdrop" onClick={onClose}><article className="stay-detail" role="dialog" aria-modal="true" aria-label={`${spot.name}の詳細`} onClick={event => event.stopPropagation()}><button className="stay-detail-close" onClick={onClose} aria-label="閉じる">×</button><div className="stay-detail-image"><img src={spot.image_url || FALLBACK_IMAGE} alt={spot.name}/></div><div className="stay-detail-body">{spot.is_featured && <b className="stay-featured">★ 宿主おすすめ</b>}<small>{spot.categories.map(item => item.name).join(" · ")}</small><h2>{spot.name}</h2><blockquote><span>宿主のひとこと</span>{spot.host_comment}</blockquote>{spot.description && <p>{spot.description}</p>}<dl>{spot.address && <><dt>住所</dt><dd>{spot.address}</dd></>}{spot.business_hours && <><dt>営業時間</dt><dd>{spot.business_hours}</dd></>}{spot.closed_days && <><dt>定休日</dt><dd>{spot.closed_days}</dd></>}<dt>宿から</dt><dd>{travelLabel(stay, spot)}</dd></dl><div className="stay-detail-links"><a className="primary" href={mapsUrl(spot)} target="_blank" rel="noreferrer" onClick={() => void track("google_maps_click", stay.id, spot.id)}>Google Mapsで開く ↗</a>{spot.instagram_url && <a href={spot.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}{spot.website_url && <a href={spot.website_url} target="_blank" rel="noreferrer">Webサイト</a>}</div></div></article></div>;
}
function mapsUrl(spot: StaySpot) { return spot.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`; }
function travelLabel(stay: StayMap, spot: StaySpot) { if (spot.walking_time || spot.driving_time) return [spot.walking_time && `徒歩${spot.walking_time}`, spot.driving_time && `車${spot.driving_time}`].filter(Boolean).join(" · "); if (spot.distance_label) return spot.distance_label; if (stay.latitude != null && stay.longitude != null) return `約${distanceKm(stay.latitude, stay.longitude, spot.latitude, spot.longitude).toFixed(1)}km`; return "宿からの移動目安は詳細へ"; }
async function track(eventType: string, stayId: string, spotId?: string) { try { await fetch("/api/stay-map/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType, stayId, spotId }) }); } catch {} }
