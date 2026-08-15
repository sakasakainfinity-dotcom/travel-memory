"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PreviewCell = { cleared: boolean; photoUrl: string | null };
type SavedProgress = { startTime?: string; clearedIds?: string[] };
type BingoItem = { id: string; position: number };

const emptyCells = (): PreviewCell[] => Array.from({ length: 25 }, () => ({ cleared: false, photoUrl: null }));

export default function DaigoExplore() {
  const [cells, setCells] = useState<PreviewCell[]>(emptyCells);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: game } = await supabase
        .from("bingos")
        .select("id,items:bingo_items(id,position)")
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
          for (const id of progress.clearedIds ?? []) {
            const position = positions.get(id);
            if (position !== undefined && position < 25) next[position].cleared = true;
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
            .select("bingo_item_id,is_cleared,photo_url")
            .eq("session_id", bingoSession.id)
            .eq("is_cleared", true);
          for (const row of progressRows ?? []) {
            const position = positions.get(row.bingo_item_id);
            if (position === undefined || position >= 25) continue;
            next[position].cleared = true;
            if (row.photo_url) {
              if (/^https?:\/\//.test(row.photo_url)) next[position].photoUrl = row.photo_url;
              else {
                const { data } = await supabase.storage.from("bingo-photos").createSignedUrl(row.photo_url, 3600);
                next[position].photoUrl = data?.signedUrl ?? null;
              }
            }
          }
        }
      }

      if (active) {
        setCells(next);
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
      <div className="daigo-preview" aria-label={`BINGO進捗 ${clearCount}マス達成`}>
        {cells.map((cell, position) => <div className={`daigo-preview-cell${cell.cleared ? " is-clear" : ""}${cell.photoUrl ? " has-photo" : ""}`} key={position} style={cell.photoUrl ? { backgroundImage: `url(${JSON.stringify(cell.photoUrl)})` } : undefined}>
          {!cell.cleared && <span aria-hidden>⌁</span>}{cell.cleared && <b aria-label="達成済み">✓</b>}
        </div>)}
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
