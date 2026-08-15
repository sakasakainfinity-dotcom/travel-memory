"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppMenu from "@/components/AppMenu";
import MagicLinkLogin from "@/components/MagicLinkLogin";
import { supabase } from "@/lib/supabaseClient";

type Entitlement = { entitlement_type: "if_then_bingo" | "stay_coupon"; active: boolean; valid_from: string | null; valid_until: string | null };

export default function MemberPage() {
  const [state, setState] = useState<"checking" | "login" | "ready">("checking");
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  useEffect(() => { void (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setState("login"); return; }
    const { data } = await supabase.from("user_entitlements").select("entitlement_type,active,valid_from,valid_until").eq("user_id", session.user.id).eq("active", true);
    setEntitlements((data ?? []) as Entitlement[]); setState("ready");
  })(); }, []);
  if (state === "login") return <MagicLinkLogin next="/member" title="会員ページ"/>;
  if (state === "checking") return <main className="bingo-shell"><div className="bingo-wrap">会員情報を確認しています…</div></main>;
  const now = Date.now();
  const available = (type: Entitlement["entitlement_type"]) => entitlements.find(item => item.entitlement_type === type && (!item.valid_from || Date.parse(item.valid_from) <= now) && (!item.valid_until || Date.parse(item.valid_until) >= now));
  const coupon = available("stay_coupon"); const ifThen = available("if_then_bingo");
  return <main className="bingo-shell"><AppMenu/><div className="bingo-wrap explore-page"><div className="bingo-brand">MEMBER</div><h1 className="bingo-title">マイページ</h1><p className="explore-lead">あなたが利用できるサービスです。</p>
    <section className="member-services"><h2>利用中の特典</h2>{coupon ? <article className="bingo-card"><h3>大子町 滞在中クーポン</h3>{coupon.valid_until && <p>利用期限：{new Date(coupon.valid_until).toLocaleDateString("ja-JP")}まで</p>}<Link className="explore-primary" href="/coupons/stay">クーポンを見る →</Link></article> : <div className="bingo-card"><p>現在利用できるクーポンはありません。</p></div>}</section>
    {ifThen && <section className="member-services"><h2>利用できるサービス</h2><article className="bingo-card"><h3>IF THEN BINGO</h3><p>あなたのIF THEN BINGOを開きます。</p><Link className="explore-primary" href="/habit">開く →</Link></article></section>}
    <Link className="explore-member-link" href="/explore/daigo">大子町の町探索へ</Link>
  </div></main>;
}
