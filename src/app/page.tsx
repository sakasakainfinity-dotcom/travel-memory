"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { reverseGeocodeMunicipality, type MunicipalityInfo } from "@/lib/municipality";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const CATEGORIES = ["食事", "宿泊", "体験", "お土産", "店舗", "娯楽", "マニアック", "その他"];

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
  const [selectedPost, setSelectedPost] = useState<PlaceWithPhotos | null>(null);
  const [newPoint, setNewPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pointMunicipality, setPointMunicipality] = useState<MunicipalityInfo | null>(null);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [profilePoints, setProfilePoints] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("ゲスト");
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 35.68, lng: 139.76 });
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; label?: string } | null>(null);
  const [booting, setBooting] = useState(true);
  const [posting, setPosting] = useState(false);

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
    () => rawPosts.filter((p) => p.municipalityKey === selectedMunicipalityKey),
    [rawPosts, selectedMunicipalityKey]
  );

  const selectedMunicipality = useMemo(
    () => municipalityMarkers.find((m) => m.id === selectedMunicipalityKey) ?? null,
    [municipalityMarkers, selectedMunicipalityKey]
  );

  const openedMunicipalityCount = municipalityMarkers.length;
  const openedPrefectureCount = new Set(municipalityMarkers.map((x) => x.prefectureName)).size;
  const rank = resolveRank(profilePoints);

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
          onRequestNew={async (p) => {
            const uid = await syncAuthState();
            if (!uid) {
              setLoginPrompt(true);
              return;
            }
            setNewPoint(p);
            const municipality = await reverseGeocodeMunicipality(p.lat, p.lng).catch(() => null);
            setPointMunicipality(municipality);
            if (municipality?.municipalityKey) setSelectedMunicipalityKey(municipality.municipalityKey);
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

        {selectedMunicipality && (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: 12, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{selectedMunicipality.municipalityName}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>{selectedMunicipality.prefectureName} / 投稿 {selectedPosts.length}件</div>
            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {selectedPosts.map((post) => (
                <button
                  key={post.id}
                  style={{ minWidth: 180, border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", textAlign: "left", padding: 0, overflow: "hidden" }}
                  onClick={() => setSelectedPost(post)}
                >
                  {post.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.photos[0]} alt={post.title ?? "投稿画像"} style={{ width: "100%", height: 110, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: 110, display: "grid", placeItems: "center", background: "#f1f5f9", color: "#64748b" }}>No Image</div>
                  )}
                  <div style={{ padding: 8 }}>
                    <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{post.title?.trim() || "無題"}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{post.createdBy || "名無しの旅人"}</div>
                  </div>
                </button>
              ))}
              {selectedPosts.length === 0 && <div style={{ color: "#64748b" }}>まだ投稿がありません。</div>}
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
        )}
      </section>

      {newPoint && (
        <section style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 40 }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setPosting(true);
                await insertPlace({
                  title,
                  memo,
                  lat: newPoint.lat,
                  lng: newPoint.lng,
                  files,
                  tags: category ? [category] : [],
                });
                setNewPoint(null);
                setPointMunicipality(null);
                setTitle("");
                setMemo("");
                setCategory("");
                setFiles([]);
                await load();
              } finally {
                setPosting(false);
              }
            }}
            style={{ width: "min(92vw, 540px)", background: "white", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}
          >
            <h2 style={{ fontWeight: 900 }}>投稿ページ</h2>
            <div style={{ fontSize: 13, color: "#475569" }}>
              ダブルタップ地点: {pointMunicipality ? `${pointMunicipality.prefectureName} ${pointMunicipality.municipalityName}` : "取得中..."}
            </div>
            <label style={{ display: "grid", gap: 4 }}>
              <span>① タイトル（任意）</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>② 画像アップロード（圧縮して投稿）</span>
              <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} required />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>③ ひとこと（任意）</span>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="ひとこと" style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, minHeight: 80 }} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span>④ カテゴリー（任意）</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: 8 }}>
                <option value="">選択しない</option>
                {CATEGORIES.map((c) => <option value={c} key={c}>{c}</option>)}
              </select>
            </label>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, background: "#f8fafc" }}>⑤ 投稿者: {accountName}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setNewPoint(null)} disabled={posting}>閉じる</button>
              <button type="submit" disabled={posting}>{posting ? "投稿中..." : "投稿する"}</button>
            </div>
          </form>
        </section>
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
