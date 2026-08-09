"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import { supabase } from "@/lib/supabaseClient";

type Town = { id: string; slug: string; title: string; municipality_name: string; description: string | null; cover_image_url: string | null };

export default function TownBingoIndex() {
  const [towns, setTowns] = useState<Town[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.from("bingos").select("id,slug,title,municipality_name,description,cover_image_url").eq("is_published", true).order("title").then(({ data, error: loadError }) => {
      setTowns(data ?? []);
      if (loadError) setError("BINGO一覧を読み込めませんでした");
    });
  }, []);

  return <main className="bingo-shell"><AppMenu current="town-bingo"/><div className="bingo-wrap">
    <div className="bingo-brand">TOWN BINGO</div>
    <h1 className="bingo-title">街を歩けば、<br/>発見がそろう。</h1>
    <p>写真と謎解きを楽しみながら、まちの魅力を見つけよう。</p>
    <Link className="bingo-habit-link" href="/habit">
      <span><span className="bingo-brand">HABIT BINGO</span><b>習慣をビンゴで楽しむ</b><small>毎日の習慣を記録して、ごほうびを目指そう。</small></span>
      <strong>はじめる →</strong>
    </Link>
    {error && <p className="bingo-error">{error}</p>}
    <div className="bingo-list">
      {towns.map((town) => <Link href={`/bingo/${town.slug}`} key={town.id}><article className="bingo-card"><div className="bingo-brand">{town.municipality_name}</div><h2>{town.title}</h2><p>{town.description}</p><b>この街でスタート →</b></article></Link>)}
      {!error && !towns.length && <div className="bingo-card">公開中のTownBingoを準備しています。</div>}
    </div>
  </div></main>;
}
