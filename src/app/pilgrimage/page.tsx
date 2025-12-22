"use client";

import { useRouter } from "next/navigation";

export default function PilgrimageHome() {
  const router = useRouter();

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-black via-neutral-950 to-neutral-900 text-white">
      {/* Top bar */}
      <header className="mx-auto max-w-5xl px-4 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-white/10 grid place-items-center border border-white/10">
            🧭
          </div>
          <div className="leading-tight">
            <div className="text-sm text-white/70">Pilgrimage</div>
            <div className="text-lg font-semibold">巡礼マップ</div>
          </div>
        </div>

        {/* 地図に戻るボタン（復活） */}
        <button
          onClick={() => router.push("/")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
        >
          ← 地図に戻る
        </button>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-4 pt-10 pb-10">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                ✨ 日本の絶景を“集める”旅
              </div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                日本の絶景をめぐって、<br className="hidden md:block" />
                ピンを塗りつぶせ。
              </h1>
              <p className="text-white/70 max-w-xl">
                行った証拠は写真。達成は地図が覚える。
                旅のログを“コレクション”に変える巡礼モード。
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button
                onClick={() => router.push("/pilgrimage/jp-world-heritage")}
                className="rounded-2xl bg-white text-black px-5 py-3 font-semibold hover:opacity-90 transition"
              >
                日本の世界遺産 巡礼マップへ →
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-white/85 hover:bg-white/10 transition"
              >
                まずは地図で投稿する
              </button>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xl">📍</div>
            <div className="mt-2 font-semibold">ピンを塗る</div>
            <div className="mt-1 text-sm text-white/70">
              スポットに投稿すると自動で“達成”に。
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xl">🖼️</div>
            <div className="mt-2 font-semibold">写真が証明</div>
            <div className="mt-1 text-sm text-white/70">
              旅の記録が、次の旅の衝動になる。
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xl">🏆</div>
            <div className="mt-2 font-semibold">達成を見える化</div>
            <div className="mt-1 text-sm text-white/70">
              進捗・達成・賞状。全部ここに出す。
            </div>
          </div>
        </section>

        {/* Footer hint */}
        <div className="mt-8 text-xs text-white/50">
          ※まずは世界遺産から。慣れたら「日本の絶景100」みたいに拡張できる。
        </div>
      </main>
    </div>
  );
}

