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
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const categories = useMemo(() => Array.from(new Map(stay.spots.flatMap(spot => spot.categories).map(item => [item.id, item])).values()), [stay.spots]);
  const spots = useMemo(() => category === "all" ? stay.spots : stay.spots.filter(spot => spot.categories.some(item => item.id === category)), [category, stay.spots]);

  useEffect(() => { void track("map_view", stay.id); }, [stay.id]);
  useEffect(() => {
    if (selected && !spots.some(spot => spot.id === selected.id)) setSelected(spots[0] ?? null);
  }, [selected, spots]);
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({ container: container.current, style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] }, center: [stay.longitude ?? 140.3507, stay.latitude ?? 36.7681], zoom: 12 });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = instance;
    return () => { markers.current.forEach(marker => marker.remove()); instance.remove(); map.current = null; };
  }, [stay.latitude, stay.longitude]);
  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach(marker => marker.remove());
    markers.current = spots.map((spot, index) => {
      const button = document.createElement("button");
      button.className = `stay-map-pin${spot.is_featured ? " is-featured" : ""}`;
      button.dataset.spotId = spot.id;
      button.textContent = String(index + 1);
      button.title = spot.name;
      button.setAttribute("aria-label", `${spot.name}を選択`);
      button.onclick = () => openSpot(spot);
      return new maplibregl.Marker({ element: button, anchor: "bottom" }).setLngLat([spot.longitude, spot.latitude]).addTo(map.current!);
    });
    const points = spots.map(spot => [spot.longitude, spot.latitude] as [number, number]);
    if (stay.latitude != null && stay.longitude != null) points.push([stay.longitude, stay.latitude]);
    if (points.length) {
      const bounds = points.slice(1).reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(points[0], points[0]));
      map.current.fitBounds(bounds, { padding: 48, maxZoom: 15 });
    }
  // Markers only need rebuilding when the filtered collection changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, stay.latitude, stay.longitude]);
  useEffect(() => {
    markers.current.forEach(marker => marker.getElement().classList.toggle("is-selected", marker.getElement().dataset.spotId === selected?.id));
  }, [selected, spots]);

  const openSpot = (spot: StaySpot) => { setSelected(spot); void track("spot_view", stay.id, spot.id); };
  return <main className="stay-map-page">
    <section className="stay-map-content">
      {stay.slug === "motomachi" && <h1 className="stay-map-title">まちやど　ガイドマップ</h1>}
      <div className="stay-map-explorer">
        <nav className="stay-map-filters" aria-label="カテゴリ絞り込み"><button aria-pressed={category === "all"} onClick={() => setCategory("all")}>すべて</button>{categories.map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.name}</button>)}</nav>
        <div ref={container} className="stay-map-canvas" aria-label={`${stay.name}周辺のおすすめ地図`}/>
        <div className="stay-mobile-detail" aria-live="polite">
          {selected ? <SpotInformation stay={stay} spot={selected}/> : <p className="stay-detail-prompt">地図のピンをタップすると<br/>おすすめ情報が表示されます</p>}
        </div>
      </div>
      <div className="stay-spot-list">{spots.map((spot, index) => <article className="stay-spot-card" key={spot.id} onClick={() => openSpot(spot)}>
        <button className="stay-card-main" aria-label={`${spot.name}の詳細を見る`}><div className="stay-card-image"><img src={spot.image_url || FALLBACK_IMAGE} alt={spot.name}/><span>{index + 1}</span>{spot.is_featured && <b>★ 宿主おすすめ</b>}</div><div className="stay-card-copy"><small>{categoryNames(spot)}</small><h3>{spot.name}</h3><p><em>宿主からの一言</em>{spot.host_comment}</p>{spot.local_comment && <p><em>地元民からの一言</em>{spot.local_comment}</p>}<div>{travelLabel(stay, spot)}</div></div></button>
        <a href={mapsUrl(spot)} target="_blank" rel="noreferrer" onClick={event => { event.stopPropagation(); void track("google_maps_click", stay.id, spot.id); }}>Google Mapsで開く ↗</a>
      </article>)}</div>
      {!spots.length && <p className="stay-map-empty">宿主おすすめのスポットを準備しています。公開まで少しお待ちください。</p>}
    </section>
    {selected && <div className="stay-desktop-detail"><div className="stay-detail-backdrop" onClick={() => setSelected(null)}><article className="stay-detail" role="dialog" aria-modal="true" aria-label={`${selected.name}の詳細`} onClick={event => event.stopPropagation()}><button className="stay-detail-close" onClick={() => setSelected(null)} aria-label="閉じる">×</button><div className="stay-detail-image"><img src={selected.image_url || FALLBACK_IMAGE} alt={selected.name}/></div><SpotInformation stay={stay} spot={selected}/></article></div></div>}
  </main>;
}

function SpotInformation({ stay, spot }: { stay: StayMap; spot: StaySpot }) {
  return <div className="stay-detail-body">
    <div className="stay-detail-heading"><div>{spot.is_featured && <b className="stay-featured">★ 宿主おすすめ</b>}<h2>{spot.name}</h2></div><small>{categoryNames(spot)}</small></div>
    <div className="stay-travel-times"><strong>🚶 <span>宿から徒歩</span> {spot.walking_time || "情報未登録"}</strong><strong>🚗 <span>車で</span> {spot.driving_time || "情報未登録"}</strong></div>
    <dl><dt>営業時間</dt><dd>{spot.business_hours || "情報未登録"}</dd><dt>定休日</dt><dd>{spot.closed_days || "情報未登録"}</dd></dl>
    {spot.host_comment && <blockquote><span>宿主より</span>{spot.host_comment}</blockquote>}
    <div className="stay-desktop-extra">{spot.local_comment && <blockquote><span>地元民からの一言</span>{spot.local_comment}</blockquote>}{spot.description && <p>{spot.description}</p>}{spot.address && <dl><dt>住所</dt><dd>{spot.address}</dd><dt>宿から</dt><dd>{travelLabel(stay, spot)}</dd></dl>}</div>
    <div className="stay-detail-links"><a className="primary" href={mapsUrl(spot)} target="_blank" rel="noreferrer" onClick={() => void track("google_maps_click", stay.id, spot.id)}>Google Mapsで見る ↗</a><div>{spot.website_url && <a href={spot.website_url} target="_blank" rel="noreferrer">Web</a>}{spot.instagram_url && <a href={spot.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}</div></div>
  </div>;
}

function categoryNames(spot: StaySpot) { return spot.categories.map(item => item.name).join(" · ") || "おすすめ"; }
function mapsUrl(spot: StaySpot) { return spot.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`; }
function travelLabel(stay: StayMap, spot: StaySpot) { if (spot.walking_time || spot.driving_time) return [spot.walking_time && `徒歩${spot.walking_time}`, spot.driving_time && `車${spot.driving_time}`].filter(Boolean).join(" · "); if (spot.distance_label) return spot.distance_label; if (stay.latitude != null && stay.longitude != null) return `約${distanceKm(stay.latitude, stay.longitude, spot.latitude, spot.longitude).toFixed(1)}km`; return "宿からの移動目安は詳細へ"; }
async function track(eventType: string, stayId: string, spotId?: string) { try { await fetch("/api/stay-map/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventType, stayId, spotId }) }); } catch {} }
