"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { insertPlace } from "@/lib/insertPlace";
import { fetchPlaces, type PlaceWithPhotos } from "@/lib/fetchPlaces";
import SearchBox from "@/components/SearchBox";
import MunicipalitySearchBox from "@/components/MunicipalitySearchBox";
import { pointsToNextRank, resolveRank } from "@/lib/rank";
import { MUNICIPALITIES } from "@/lib/municipalities";
import PhotoMapperSplash from "@/components/PhotoMapperSplash";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Marker = {
  id: string;
  name: string;
  memo?: string;
  lat: number;
  lng: number;
  postCount: number;
  municipalityKey: string;
  municipalityName: string;
  prefectureName: string;
};

export default function UnifiedTopPage() {
  const router = useRouter();
  const [rawPosts, setRawPosts] = useState<PlaceWithPhotos[]>([]);
  const [selectedMunicipalityKey, setSelectedMunicipalityKey] = useState<string | null>(null);
  const [newPoint, setNewPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [profilePoints, setProfilePoints] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 35.68, lng: 139.76 });
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; label?: string } | null>(null);
  const [booting, setBooting] = useState(true);

  const load = async () => {
    try {
      const [posts, sessionRes] = await Promise.all([fetchPlaces(), supabase.auth.getSession()]);
      setRawPosts(posts);
      const uid = sessionRes.data.session?.user.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: prof } = await supabase.from("profiles").select("total_points").eq("id", uid).maybeSingle();
        setProfilePoints(prof?.total_points ?? 0);
      }
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const latParam = params.get("lat");
    const lngParam = params.get("lng");
    if (!latParam || !lngParam) return;

    const lat = Number(latParam);
    const lng = Number(lngParam);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const zoomParam = Number(params.get("zoom") ?? "11");
    const municipality = params.get("municipality") ?? undefined;
    const nextZoom = Number.isNaN(zoomParam) ? 11 : zoomParam;

    setCenter({ lat, lng });
    setFlyTo({ lat, lng, zoom: nextZoom, label: municipality });
  }, []);


  const municipalityMarkers = useMemo<Marker[]>(() => {
    const map = new Map<string, Marker>();
    for (const post of rawPosts) {
      const key = post.municipalityKey;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: `${post.municipalityName}`,
          memo: post.prefectureName,
          lat: post.lat,
          lng: post.lng,
          postCount: 1,
          municipalityKey: key,
          municipalityName: post.municipalityName,
          prefectureName: post.prefectureName,
        });
      } else {
        map.get(key)!.postCount += 1;
      }
    }
    return Array.from(map.values());
  }, [rawPosts]);

  const selectedPosts = useMemo(
    () => rawPosts.filter((p) => p.municipalityKey === selectedMunicipalityKey).slice(0, 20),
    [rawPosts, selectedMunicipalityKey]
  );

  const openedMunicipalityCount = municipalityMarkers.length;
  const openedPrefectureCount = new Set(municipalityMarkers.map((x) => x.prefectureName)).size;
  const rank = resolveRank(profilePoints);

  const nearestUnexploredHint = useMemo(() => {
    if (!municipalityMarkers.length) return "近くの未踏の地を計算中…";
    return `地図中心(${center.lat.toFixed(2)}, ${center.lng.toFixed(2)})付近の未踏地探索を準備中`; 
  }, [municipalityMarkers.length, center]);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 96 }}>
      <AppMenu current="map" />
      <section style={{ padding: 12, display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>photoMapper | 全国・開拓マップ</h1>
        <div style={{ display: "grid", gap: 6, border: "1px solid #dbeafe", borderRadius: 12, background: "#fff", padding: 10 }}>
          <div style={{ fontWeight: 800, color: rank.color }}>{rank.icon} {rank.label} / {profilePoints}pt</div>
          <div>次ランクまであと {pointsToNextRank(profilePoints)}pt</div>
          <div>開拓市町村: {openedMunicipalityCount} / 開拓都道府県: {openedPrefectureCount}</div>
          <div>特典メーター: 500ptで大子町ゲストハウス1泊無料・1000ptでひたちなか古民家宿1泊無料</div>
        </div>
      </section>

      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 56px)",
          left: "max(12px, env(safe-area-inset-left, 0px))",
          zIndex: 60,
          width: "clamp(220px, 60vw, 340px)",
        }}
      >
        <MunicipalitySearchBox
          items={MUNICIPALITIES}
          maxResults={30}
          placeholder="市町村・都道府県を検索（2文字以上）"
          onPick={(item) => {
            setCenter({ lat: item.lat, lng: item.lng });
            setFlyTo({ lat: item.lat, lng: item.lng, zoom: 11, label: item.fullName });
          }}
        />
      </div>

      <section style={{ padding: "0 12px 12px" }}>
        <SearchBox
          places={municipalityMarkers}
          onPickPost={({ id }) => setSelectedMunicipalityKey(id)}
          onPickLocation={({ lat, lng }) => setCenter({ lat, lng })}
        />
      </section>

      <section style={{ height: 380, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <MapView
          places={municipalityMarkers}
          onRequestNew={(p) => {
            if (!userId) {
              setLoginPrompt(true);
              return;
            }
            setNewPoint(p);
          }}
          onSelect={(p) => setSelectedMunicipalityKey(p.id)}
          selectedId={selectedMunicipalityKey}
          onCenterChange={setCenter}
          showCenterMarker
          flyTo={flyTo}
        />
      </section>

      <section style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 10 }}>
          <div style={{ fontWeight: 900 }}>近くの未踏の地</div>
          <div style={{ color: "#475569", fontSize: 13 }}>{nearestUnexploredHint}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>つばめが待つ未開拓エリアを順次表示予定です。</div>
        </div>

        {selectedMunicipalityKey && (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 10 }}>
            <div style={{ fontWeight: 900 }}>市町村投稿パネル</div>
            <div style={{ marginTop: 6 }}>総投稿数: {selectedPosts.length}</div>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {selectedPosts.map((post) => (
                <article key={post.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 8 }}>
                  <div style={{ fontWeight: 800 }}>{post.name ?? "無題"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{post.prefectureName} / {post.municipalityName}</div>
                  {post.memo && <p style={{ fontSize: 13 }}>{post.memo}</p>}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {newPoint && (
        <section style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 40 }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await insertPlace({ title, memo, lat: newPoint.lat, lng: newPoint.lng, files });
              setNewPoint(null);
              setTitle("");
              setMemo("");
              setFiles([]);
              await load();
            }}
            style={{ width: "min(92vw, 480px)", background: "white", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}
          >
            <h2 style={{ fontWeight: 900 }}>新規投稿（ログイン必須）</h2>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" required style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, minHeight: 80 }} />
            <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setNewPoint(null)}>閉じる</button>
              <button type="submit">投稿する</button>
            </div>
          </form>
        </section>
      )}

      {loginPrompt && (
        <section style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 40 }}>
          <div style={{ width: "min(92vw, 380px)", background: "white", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900 }}>投稿にはログインが必要です</div>
            <p style={{ margin: 0, color: "#475569" }}>ログイン後は投稿・いいね・行きたい・行ったが使えます。</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setLoginPrompt(false)}>閉じる</button>
              <button onClick={() => router.push("/login")}>ログインする</button>
            </div>
          </div>
        </section>
      )}

      {booting && <PhotoMapperSplash />}
    </main>
  );
}
