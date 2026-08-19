"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PreviewCell = { cleared: boolean; clearedAt?: string; photo?: string };
type SavedProgress = {
  startTime?: string;
  clearedIds?: string[];
  customTitle?: string;
  clearedAtById?: Record<string, string>;
  photoById?: Record<string, string>;
};
type BingoItem = { id: string; position: number; type: "photo" | "quiz" | "user_mission"; title: string; active: boolean };

const emptyCells = (): PreviewCell[] => Array.from({ length: 25 }, () => ({ cleared: false }));

export default function DaigoExplore() {
  const [cells, setCells] = useState<PreviewCell[]>(emptyCells);
  const [items, setItems] = useState<BingoItem[]>([]);
  const [started, setStarted] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: game } = await supabase
        .from("bingos")
        .select("id,items:bingo_items(id,position,type,title,active)")
        .eq("slug", "daigo")
        .eq("is_published", true)
        .maybeSingle();
      if (!active || !game) return;

      const items = (game.items ?? []) as BingoItem[];
      const positions = new Map(items.map((item) => [item.id, item.position]));
      const next = emptyCells();
      let hasStarted = false;

      const saved = localStorage.getItem("town-bingo-progress:daigo");
      if (saved) {
        try {
          const progress = JSON.parse(saved) as SavedProgress;
          hasStarted = Boolean(progress.startTime);
          setCustomTitle(progress.customTitle ?? "");
          for (const id of progress.clearedIds ?? []) {
            const position = positions.get(id);
            const item = items.find((candidate) => candidate.id === id);
            if ((item?.type === "user_mission" || position === 12) && !progress.customTitle) continue;
            if (position !== undefined && position < 25) {
              next[position] = {
                cleared: true,
                clearedAt: progress.clearedAtById?.[id],
                photo: progress.photoById?.[id],
              };
            }
          }
        } catch {
          // The game screen owns invalid local progress cleanup.
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: bingoSession } = await supabase
          .from("bingo_sessions")
          .select("id")
          .eq("bingo_id", game.id)
          .eq("user_id", session.user.id)
          .in("status", ["active", "completed"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (bingoSession) {
          hasStarted = true;
          const { data: progressRows } = await supabase
            .from("bingo_progress")
            .select("bingo_item_id,is_cleared,cleared_at,photo_url")
            .eq("session_id", bingoSession.id)
            .eq("is_cleared", true);
          for (const row of progressRows ?? []) {
            const position = positions.get(row.bingo_item_id);
            if (position === undefined || position >= 25) continue;
            next[position] = {
              cleared: true,
              clearedAt: row.cleared_at ?? next[position].clearedAt,
              photo: row.photo_url ?? next[position].photo,
            };
          }
        }
      }

      if (active) {
        setCells(next);
        setItems(items);
        setStarted(hasStarted);
      }
    })();
    return () => { active = false; };
  }, []);

  const clearCount = cells.filter((cell) => cell.cleared).length;

  return <div className="daigo-page">
    <header className="daigo-header"><Link href="/explore">← 町探索</Link></header>

    <section className="daigo-hero" aria-label="大子町の風景">
      <div className="daigo-hero-copy">
        <span>茨城県</span><h1>大子町</h1>
        <p>歩いて、見つけて、<br />大子町を楽しもう。</p>
        <small>DAIGO, IBARAKI</small>
      </div>
    </section>

    <section className="daigo-bingo-card">
      <div className="daigo-section-head">
        <div><h2>町BINGO</h2><p>町を歩きながら、写真と謎解きを楽しもう。</p></div>
        <div className="daigo-clear"><strong>{clearCount} <i>/</i> 25</strong><span>CLEAR</span></div>
      </div>
      <div className="bingo-grid bingo-grid-5 daigo-game-preview" role="grid" aria-label={`BINGO進捗 ${clearCount}マス達成`}>
        {cells.map((cell, position) => {
          const item = items.find((candidate) => candidate.position === position);
          const isMission = item?.type === "user_mission" || position === 12;
          const clearedTime = cell.clearedAt ? formatClearedTime(cell.clearedAt) : null;
          return <div role="gridcell" aria-label={`${position + 1}マス目${cell.cleared ? `、達成済み${clearedTime ? `、${clearedTime}` : ""}` : ""}`} className={`bingo-cell${cell.cleared ? " is-clear" : ""}`} key={position}>
            {!item?.active ? <span className="bingo-empty">—</span> : isMission ? <span className="user-mission-cell">
              {cell.cleared ? <span className="bingo-clear-details"><b>✓ 達成！</b><small>{customTitle || item.title}</small>{clearedTime && <time dateTime={cell.clearedAt}>達成 {clearedTime}</time>}</span> : <><b>YOUR MISSION</b><small>{customTitle || "今回の旅でやりたいことを決めよう！"}</small>{!customTitle && <em>＋ 設定する</em>}</>}
            </span> : cell.cleared ? <span className={cell.photo ? "bingo-photo-cell" : ""}>{cell.photo && <img src={cell.photo} alt={`${item.title}の投稿写真`}/>}<span className="bingo-clear-details"><b>✓ 達成！</b><small>{item.title}</small>{clearedTime && <time dateTime={cell.clearedAt}>達成 {clearedTime}</time>}</span></span> : item.title}
          </div>;
        })}
      </div>
      <Link className="daigo-primary" href="/bingo/daigo">{started ? "BINGOの続きを遊ぶ" : "BINGOをはじめる"}<span aria-hidden>→</span></Link>
    </section>

    <section className="daigo-ticket">
      <div className="daigo-ticket-top"><span>公式HP予約＋会員登録者限定</span><small>STAY BENEFIT</small></div>
      <div className="daigo-ticket-body"><div><p>滞在中クーポン</p><strong>¥500 <em>OFF</em></strong></div><div className="daigo-stamp" aria-hidden>DAIGO<br />STAY</div></div>
      <p className="daigo-ticket-copy">まちやど公式HPからご予約後、会員登録された方限定の滞在特典です。</p>
      <p className="daigo-ticket-condition">対象店舗で4,000円以上のお食事にご利用いただけます。</p>
      <Link className="daigo-primary" href="/coupons/stay">クーポンを確認する<span aria-hidden>→</span></Link>
    </section>

    <Link className="daigo-member-link" href="/member"><span aria-hidden>♙</span> マイページへ <span aria-hidden>→</span></Link>
  </div>;
}

function formatClearedTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
