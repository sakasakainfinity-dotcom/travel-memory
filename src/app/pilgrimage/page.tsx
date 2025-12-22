"use client";

import { useRouter } from "next/navigation";

export default function PilgrimageMenuPage() {
  const router = useRouter();

  const addLayer = (slug: string) => {
    // 将来：お気に入り/課金の管理もここに入れる
    localStorage.setItem("tm_layer_toggle_visible", "1");

    // 既存のON一覧に追加（重複は除外）
    const raw = localStorage.getItem("tm_enabled_layer_slugs");
    let arr: string[] = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = [];
    }
    const next = Array.from(new Set([...arr, slug]));
    localStorage.setItem("tm_enabled_layer_slugs", JSON.stringify(next));

    // private地図へ
    router.push("/");
  };

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-black via-neutral-950 to-[#060A12] text-white">
      {/* Top */}
      <header className="mx-auto max-w-5xl px-4 pt-6 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
        >
          ← 地図へ
        </button>

        <div className="text-xs text-white/50">
          Pilgrimage Mode
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-10">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
              巡礼マップ
            </h1>
            <p className="mt-2 text-white/60 text-sm md:text-base">
              地図にレイヤーを重ねて、ピンを塗れ。
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              🏯 未訪問：輪郭
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              🏯 訪問：塗り
            </span>
          </div>
        </div>

        {/* Layer Cards */}
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {/* World Heritage */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-white/50">LAYER</div>
                <div className="mt-1 text-lg font-semibold">日本の世界遺産</div>
                <div className="mt-2 text-sm text-white/60">
                  地図に重ねて、行った場所を塗る。
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-xl">
                🏯
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => addLayer("jp-world-heritage")}
                className="flex-1 rounded-2xl bg-white text-black px-4 py-3 font-semibold hover:opacity-90 transition"
              >
                地図に追加 →
              </button>
              <button
                onClick={() => router.push("/pilgrimage/jp-world-heritage")}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/85 hover:bg-white/10 transition"
              >
                詳細
              </button>
            </div>

            <div className="mt-3 text-xs text-white/45">
              追加すると、地図の左下にON/OFFが出ます。
            </div>
          </div>

          {/* Coming Soon */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-white/50">COMING SOON</div>
                <div className="mt-1 text-lg font-semibold">日本の絶景 100</div>
                <div className="mt-2 text-sm text-white/60">
                  近日追加。お気に入り登録で管理。
                </div>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-xl">
                ✨
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                disabled
                className="flex-1 rounded-2xl bg-white/10 text-white/50 px-4 py-3 font-semibold cursor-not-allowed"
              >
                準備中
              </button>
              <button
                disabled
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/40 cursor-not-allowed"
              >
                詳細
              </button>
            </div>

            <div className="mt-3 text-xs text-white/45">
              ※有料の「お気に入り枠」に対応予定
            </div>
          </div>
        </section>

        {/* Bottom hint (minimal text) */}
        <div className="mt-8 flex items-center justify-between">
          <div className="text-xs text-white/45">
            レイヤーは地図に重ねるだけ。マップは1枚。
          </div>
          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            地図へ戻る →
          </button>
        </div>
      </main>
    </div>
  );
}
