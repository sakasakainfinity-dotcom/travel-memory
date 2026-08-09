"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchPlaces, type PlaceWithPhotos } from "@/lib/fetchPlaces";
import SearchBox from "@/components/SearchBox";
import MunicipalitySearchBox from "@/components/MunicipalitySearchBox";
import { pointsToNextRank, resolveRank } from "@/lib/rank";
import { MUNICIPALITIES } from "@/lib/municipalities";
import { buildMunicipalityKey } from "@/lib/municipality";
import PhotoMapperSplash from "@/components/PhotoMapperSplash";
import PhotoLightbox from "@/components/PhotoLightbox";

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
  const [uiMode, setUiMode] = useState<"view" | null>(null);
  const [selectedPost, setSelectedPost] = useState<PlaceWithPhotos | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ src: string; post: PlaceWithPhotos } | null>(null);
  const [profilePoints, setProfilePoints] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("ゲスト");
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 35.68, lng: 139.76 });
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; label?: string } | null>(null);
  const [booting, setBooting] = useState(true);

  const syncAuthState = useCallback(async () => {
    const [sessionRes, userRes] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    const uid = sessionRes.data.session?.user.id ?? null;
    setUserId(uid);

    const user = userRes.data.user;
    const displayName =
      (user?.user_metadata as any)?.display_name ||
      (user?.user_metadata as any)?.name ||
      (user?.email?.split("@")[0] ?? "ゲスト");
    setAccountName(displayName);

    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("total_points").eq("id", uid).maybeSingle();
      setProfilePoints(prof?.total_points ?? 0);
      return uid;
    }

    setProfilePoints(0);
    return null;
  }, []);

  const load = async () => {
    try {
      let posts: PlaceWithPhotos[] = [];
      try {
        posts = await fetchPlaces();
      } catch (e: any) {
        if (e?.code === "42501") {
          console.warn("[page] placesの参照権限がないため、投稿一覧は空で表示します。");
        } else {
          throw e;
        }
      }
      setRawPosts(posts);
      await syncAuthState();
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    load();
  }, [syncAuthState]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void syncAuthState();
    });
    return () => listener.subscription.unsubscribe();
  }, [syncAuthState]);

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
    const countMap = new Map<string, number>();
    for (const post of rawPosts) {
      const key = post.municipalityKey;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    return MUNICIPALITIES.map((m) => {
      const municipalityKey = buildMunicipalityKey(m.prefecture, m.city);
      return {
        id: municipalityKey,
        name: m.city,
        memo: m.prefecture,
        lat: m.lat,
        lng: m.lng,
        postCount: countMap.get(municipalityKey) ?? 0,
        municipalityKey,
        municipalityName: m.city,
        prefectureName: m.prefecture,
      };
    });
  }, [rawPosts]);

  const selectedPosts = useMemo(
    () => rawPosts.filter((p) => p.municipalityKey === selectedMunicipalityKey),
    [rawPosts, selectedMunicipalityKey]
  );

  const selectedMunicipality = useMemo(
    () => municipalityMarkers.find((m) => m.id === selectedMunicipalityKey) ?? null,
    [municipalityMarkers, selectedMunicipalityKey]
  );

  const openedMunicipalityCount = municipalityMarkers.filter((m) => m.postCount > 0).length;
  const openedPrefectureCount = new Set(
    municipalityMarkers.filter((m) => m.postCount > 0).map((x) => x.prefectureName)
  ).size;
  const rank = resolveRank(profilePoints);

  const openMunicipality = useCallback((municipalityKey: string) => {
    setSelectedMunicipalityKey(municipalityKey);
    setUiMode("view");
  }, []);

  const closePanels = useCallback(() => {
    setUiMode(null);
  }, []);

  const contributors = useMemo(() => {
    const total = selectedPosts.length;
    const map = new Map<string, number>();
    selectedPosts.forEach((post) => {
      const name = post.createdBy || "名無しの旅人";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count, ratio: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [selectedPosts]);

  const pieGradient = useMemo(() => {
    const colors = ["#2563eb", "#f97316", "#10b981", "#a855f7", "#ef4444"];
    let start = 0;
    const parts = contributors.map((c, i) => {
      const end = start + c.ratio;
      const s = `${colors[i % colors.length]} ${start}% ${end}%`;
      start = end;
      return s;
    });
    if (!parts.length) return "#e2e8f0 0 100%";
    if (start < 100) parts.push(`#e2e8f0 ${start}% 100%`);
    return parts.join(", ");
  }, [contributors]);

  const nearestUnexploredHint = useMemo(() => {
    if (!openedMunicipalityCount) return "近くの未踏の地を計算中…";
    return `地図中心(${center.lat.toFixed(2)}, ${center.lng.toFixed(2)})付近の未踏地探索を準備中`;
  }, [openedMunicipalityCount, center]);

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
          onPickPost={({ id }) => {
            openMunicipality(id);
          }}
          onPickLocation={({ lat, lng }) => setCenter({ lat, lng })}
        />
      </section>

      <section style={{ height: 380, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
        <MapView
          places={municipalityMarkers}
          onRequestNew={() => {}}
          onSelect={(p) => openMunicipality(p.id)}
          selectedId={selectedMunicipalityKey}
          onCenterChange={setCenter}
          showCenterMarker
          flyTo={flyTo}
          markerStyle="count-box"
          minZoomToShowMarkers={8.2}
          enableDoubleClickCreate={false}
        />
      </section>

      <section style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 10 }}>
          <div style={{ fontWeight: 900 }}>近くの未踏の地</div>
          <div style={{ color: "#475569", fontSize: 13 }}>{nearestUnexploredHint}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>つばめが待つ未開拓エリアを順次表示予定です。</div>
        </div>

      </section>

      {selectedMunicipality && uiMode === "view" && (
        <section style={{ position: "fixed", inset: 0, background: "rgba(2, 6, 23, 0.62)", zIndex: 42, display: "grid", placeItems: "center", padding: 12 }}>
          <div style={{ width: "min(94vw, 760px)", maxHeight: "82vh", overflowY: "auto", border: "1px solid rgba(191, 219, 254, 0.7)", borderRadius: 22, background: "rgba(255,255,255,0.84)", backdropFilter: "blur(18px)", padding: 14, display: "grid", gap: 14, boxShadow: "0 18px 54px rgba(15, 23, 42, 0.28)" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ position: "relative", minHeight: 34 }}>
                <button
                  type="button"
                  onClick={closePanels}
                  style={{ position: "absolute", left: 0, top: 0, border: "1px solid #cbd5e1", background: "rgba(255,255,255,0.82)", borderRadius: 999, padding: "6px 12px", fontWeight: 700 }}
                >
                  閉じる
                </button>
                <div style={{ textAlign: "center", fontWeight: 900, fontSize: 24, letterSpacing: "0.03em", padding: "2px 72px 0" }}>{selectedMunicipality.municipalityName}</div>
              </div>
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center" }}>{selectedMunicipality.prefectureName} / 投稿 {selectedPosts.length}件</div>
            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {selectedPosts.map((post) => {
                const coverPhoto = post.photos?.[0] ?? null;
                return (
                  <article
                    key={post.id}
                    style={{ minWidth: 214, border: "1px solid rgba(226,232,240,0.9)", borderRadius: 14, background: "rgba(255,255,255,0.86)", textAlign: "left", padding: 0, overflow: "hidden" }}
                  >
                    {coverPhoto ? (
                    <button
                      type="button"
                      style={{ border: "none", background: "transparent", padding: 0, width: "100%", cursor: "zoom-in" }}
                      onClick={() => setSelectedPhoto({ src: coverPhoto, post })}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverPhoto}
                        alt={post.title ?? "投稿画像"}
                        loading="lazy"
                        decoding="async"
                        style={{ width: "100%", height: 132, objectFit: "cover" }}
                      />
                    </button>
                    ) : (
                      <div style={{ width: "100%", height: 132, display: "grid", placeItems: "center", background: "#f1f5f9", color: "#64748b" }}>No Image</div>
                    )}
                    <button
                      type="button"
                      style={{ border: "none", background: "transparent", width: "100%", padding: 10, textAlign: "left", cursor: "pointer", display: "grid", gap: 4 }}
                      onClick={() => setSelectedPost(post)}
                    >
                      <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.title?.trim() || "無題"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{post.createdBy || "名無しの旅人"}</div>
                    </button>
                  </article>
                );
              })}
              {selectedPosts.length === 0 && (
                <div
                  style={{
                    minWidth: "100%",
                    border: "1px dashed rgba(148,163,184,0.55)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    background: "rgba(248,250,252,0.92)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/mascot/tsubame.png"
                    alt="つばめ"
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: "50%",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ position: "relative", flex: 1 }}>
                    <div
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        background: "#fff",
                        padding: "10px 12px",
                        color: "#475569",
                        lineHeight: 1.5,
                      }}
                    >
                      つばめ「ぴよっ、この街のスポットは準備中だよ。公開を楽しみに待っていてね！」
                    </div>
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: -7,
                        top: 18,
                        width: 12,
                        height: 12,
                        background: "#fff",
                        borderLeft: "1px solid #cbd5e1",
                        borderBottom: "1px solid #cbd5e1",
                        transform: "rotate(45deg)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800 }}>投稿アカウント比率</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${pieGradient})`, border: "1px solid #cbd5e1" }} />
                <div style={{ display: "grid", gap: 4 }}>
                  {contributors.length === 0 && <div style={{ color: "#64748b" }}>投稿者データなし</div>}
                  {contributors.map((c, i) => (
                    <div key={c.name} style={{ fontSize: 13 }}>
                      {i + 1}. {c.name}（{c.count}件 / {c.ratio}%）
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {selectedPhoto && (
        <PhotoLightbox
          src={selectedPhoto.src}
          title={selectedPhoto.post.title?.trim() || "無題"}
          memo={selectedPhoto.post.memo ?? ""}
          createdBy={selectedPhoto.post.createdBy || "名無しの旅人"}
          onClose={() => setSelectedPhoto(null)}
        />
      )}

      {selectedPost && (
        <section style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 45 }} onClick={() => setSelectedPost(null)}>
          <article style={{ width: "min(92vw, 560px)", maxHeight: "86vh", overflow: "auto", background: "white", borderRadius: 12, padding: 12, display: "grid", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0 }}>{selectedPost.title?.trim() || "無題"}</h3>
            <div style={{ fontSize: 13, color: "#64748b" }}>{selectedPost.createdBy || "名無しの旅人"}</div>
            {selectedPost.photos?.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${src}-${i}`} src={src} alt={`photo-${i + 1}`} style={{ width: "100%", borderRadius: 10, maxHeight: 280, objectFit: "cover" }} />
            ))}
            {selectedPost.memo && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{selectedPost.memo}</p>}
            {selectedPost.tags?.[0] && <div style={{ fontSize: 12, color: "#334155" }}>カテゴリー: {selectedPost.tags[0]}</div>}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {selectedPost.createdById === userId ? (
                <button onClick={() => router.push(`/edit/${selectedPost.id}`)}>編集する</button>
              ) : <span />}
              <button onClick={() => setSelectedPost(null)}>閉じる</button>
            </div>
          </article>
        </section>
      )}

      {booting && <PhotoMapperSplash />}
    </main>
  );
}
