"use client";

import { useRouter } from "next/navigation";

export default function PilgrimageMenuPage() {
  const router = useRouter();

  const addWorldHeritageLayer = () => {
    // 「右下トグルを表示」＋「初期状態ON」
    localStorage.setItem("tm_layer_wh_toggle_visible", "1");
    localStorage.setItem("tm_layer_wh_enabled", "1");
    router.push("/"); // private地図へ戻す（ルートが違うならここ変える）
  };

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-[#071422] via-[#06101C] to-[#050A12] text-white">
      <header className="mx-auto max-w-4xl px-4 pt-6 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
        >
          ← 戻る
        </button>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-8 pb-10">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          巡礼マップ
        </h1>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-white/60">LAYER</div>
              <div className="text-lg font-semibold">日本の世界遺産</div>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
              🏯
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={addWorldHeritageLayer}
              className="flex-1 rounded-2xl bg-white text-black px-4 py-3 font-semibold hover:opacity-90 transition"
            >
              地図に追加 →
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10 transition"
            >
              地図へ
            </button>
          </div>

          <div className="mt-3 text-xs text-white/55">
            ※右下のスイッチで表示ON/OFFできます
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-white/80 text-sm">未訪問</div>
            <div className="mt-1 text-white/60 text-xs">輪郭アイコン</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-white/80 text-sm">訪問済</div>
            <div className="mt-1 text-white/60 text-xs">塗りアイコン</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-white/80 text-sm">投稿</div>
            <div className="mt-1 text-white/60 text-xs">ピンから作成</div>
          </div>
        </div>
      </main>
    </div>
  );
}
