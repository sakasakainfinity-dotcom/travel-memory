"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Spot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type ProgressRow = {
  spot_id: string;
};

export default function WorldHeritagePilgrimagePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [achievedIds, setAchievedIds] = useState<Set<string>>(new Set());
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) return;

      // mission を引く
      const { data: m, error: me } = await supabase
        .from("pilgrimage_missions")
        .select("id")
        .eq("slug", "jp-world-heritage")
        .maybeSingle();
      if (me || !m?.id) return;

      // spots
      const { data: s, error: se } = await supabase
        .from("pilgrimage_spots")
        .select("id,name,lat,lng")
        .eq("mission_id", m.id)
        .order("sort_order", { ascending: true });
      if (se) return;

      // progress（自分）
      const { data: p, error: pe } = await supabase
        .from("pilgrimage_progress")
        .select("spot_id")
        .eq("user_id", uid);
      if (pe) return;

      setSpots((s ?? []) as Spot[]);
      setAchievedIds(new Set((p ?? []).map((r: ProgressRow) => r.spot_id)));
    })();
  }, []);

  const places = useMemo(() => {
    // MapViewが受ける型に寄せる（最低限 id/title/lat/lng）
    return spots.map((sp) => ({
      id: sp.id,
      title: sp.name,
      lat: sp.lat,
      lng: sp.lng,
      // ここに "achieved" を持たせて、MapView側でピン色を変えるのがベスト
      achieved: achievedIds.has(sp.id),
    }));
  }, [spots, achievedIds]);

  // 進捗表示
  const total = spots.length;
  const done = achievedIds.size;

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="font-semibold">日本の世界遺産巡礼マップ</div>
        <div className="text-sm text-neutral-600">{done} / {total} 達成</div>
      </div>

      <div className="flex-1">
        <MapView
  places={places as any}
  onRequestNew={(p: { lat: number; lng: number }) => {
    // 巡礼ページでは「新規投稿」はピンからさせたいなら何もしないでもOK
    // でも型エラー回避のため必須で渡す
    console.log("onRequestNew", p);
  }}
  onSelect={(p: any) => {
    const sp = spots.find((x) => x.id === p.id) ?? null;
    setSelectedSpot(sp);
 　　　　　 }}
　　　　　  selectedId={selectedSpot?.id ?? null}
　　　　/>
      </div>

      {/* 下の簡易パネル：A案の入口 */}
      <div className="p-3 border-t">
        {!selectedSpot ? (
          <div className="text-sm text-neutral-600">ピンを押して「この遺産に投稿」へ。</div>
        ) : (
          <div className="space-y-2">
            <div className="font-semibold">{selectedSpot.name}</div>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl bg-black text-white py-2 font-semibold"
                onClick={() => {
                  // ここは君の「投稿作成フロー」に合わせて繋ぐ所
                  // 例: /edit/new?lat=...&lng=...&spotId=...
                  const q = new URLSearchParams({
                    lat: String(selectedSpot.lat),
                    lng: String(selectedSpot.lng),
                    spotId: selectedSpot.id,
                  });
                  location.href = `/edit/new?${q.toString()}`;
                }}
              >
                この遺産に投稿
              </button>

              <button
                className="rounded-xl border px-3"
                onClick={() => setSelectedSpot(null)}
              >
                閉じる
              </button>
            </div>

            <div className="text-xs text-neutral-500">
              達成済み：{achievedIds.has(selectedSpot.id) ? "✅" : "—"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
