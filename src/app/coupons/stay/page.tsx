"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import MagicLinkLogin from "@/components/MagicLinkLogin";
import { supabase } from "@/lib/supabaseClient";
import styles from "./stay-coupon.module.css";

type Store = { store_id: string; store_name: string; store_image: string | null };
type Usage = { id: string; store_id: string; store_name: string; discount_amount: number; used_at: string };
type CouponData = {
  coupon: { coupon_id: string; title: string; discount_amount: number; minimum_spend: number };
  stores: Store[];
  usage: Usage | null;
  eligibility: "active" | "before" | "expired" | "denied";
  check_in: string | null;
  check_out: string | null;
};

const dateTime = (value: string) => new Intl.DateTimeFormat("ja-JP", {
  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

export default function StayCouponPage() {
  const [status, setStatus] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [data, setData] = useState<CouponData | null>(null);
  const [selected, setSelected] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const couponRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setStatus("login"); return; }
    const response = await fetch("/api/coupons/stay", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    if (response.status === 401) { setStatus("login"); return; }
    if (!response.ok) { setStatus("error"); return; }
    setData(await response.json());
    setStatus("ready");
  }, []);

  useEffect(() => { void load(); }, [load]);

  const chooseStore = (storeId: string) => {
    if (data?.usage) return;
    setSelected(storeId);
    couponRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const redeem = async () => {
    if (!selected || submitting) return;
    setSubmitting(true); setMessage("");
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch("/api/coupons/stay", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ storeId: selected }),
    });
    const result = await response.json();
    if (!response.ok) setMessage(result.error ?? "クーポンを使用できませんでした。");
    else { setConfirming(false); await load(); }
    setSubmitting(false);
  };

  if (status === "login") return <MagicLinkLogin next="/coupons/stay" title="滞在中に使えるクーポン" />;
  if (status === "loading") return <main className={styles.loading}>クーポンを確認しています…</main>;
  if (status === "error" || !data) return <main className={styles.loading}>クーポン情報を読み込めませんでした。時間をおいて再度お試しください。</main>;

  const store = data.stores.find((item) => item.store_id === selected);
  const canUse = data.eligibility === "active" && !data.usage;
  const stateMessage = data.eligibility === "before" ? "チェックイン後に利用できます" : data.eligibility === "expired" ? "このクーポンの利用期間は終了しました" : data.eligibility === "denied" ? "このアカウントではクーポンを利用できません" : "滞在中のみ有効";
  const cards: Array<Store | null> = [...data.stores, ...Array(Math.max(0, 6 - data.stores.length)).fill(null)];

  return <main className={styles.shell}>
    <header className={styles.header}><a href="/" aria-label="ホームへ"><span>まちやど</span> Motomachi</a><span className={styles.headerMark}>LOCAL STAY</span></header>
    <section className={styles.hero}>
      <span className={styles.leaf}>⌁</span><p>STAY BENEFIT</p><h1>滞在中に使えるクーポン</h1>
      <div><span aria-hidden="true">▣</span> まちやどMotomachi宿泊者・会員限定の特典です</div>
    </section>

    <section className={`${styles.coupon} ${data.usage ? styles.used : ""}`} ref={couponRef}>
      <div className={styles.couponTop}><span>{data.usage ? "USED" : "LOCAL PASSPORT"}</span><b>{data.usage ? "クーポンを使用しました" : "宿泊者限定クーポン"}</b></div>
      <div className={styles.amount}><strong>500</strong><span>円<br />OFF</span></div>
      {data.usage ? <div className={styles.usedPanel}>
        <strong>この滞在ではクーポンを利用済みです</strong>
        <dl><div><dt>使用店舗</dt><dd>{data.usage.store_name}</dd></div><div><dt>使用日時</dt><dd>{dateTime(data.usage.used_at)}</dd></div></dl>
      </div> : <>
        <div className={styles.conditions}><span>3,000円以上のお会計</span><span>{stateMessage}</span><span>1滞在につき1回のみ</span></div>
        <label className={styles.selectLabel}>利用する店舗
          <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!canUse}>
            <option value="">利用する店舗を選択してください</option>
            {data.stores.map((item) => <option key={item.store_id} value={item.store_id}>{item.store_name}</option>)}
          </select>
        </label>
        {store && <p className={styles.selection}>{store.store_name}で500円OFFクーポンを使用する</p>}
        <button className={styles.useButton} disabled={!selected || !canUse} onClick={() => setConfirming(true)}>この店舗でクーポンを使用する <span>›</span></button>
        <small className={styles.once}>一度使用すると再利用できません</small>
      </>}
    </section>

    {data.usage && <section className={styles.history}><h2>利用履歴</h2><article><span>使用済み</span><div><b>{data.usage.store_name}</b><small>{dateTime(data.usage.used_at)} 使用</small></div><strong>{data.usage.discount_amount.toLocaleString()}円OFF</strong></article></section>}

    <section className={styles.stores}><div className={styles.sectionTitle}><div><span>⌖</span><h2>クーポンが使えるお店</h2></div><small>町のお店とつながる</small></div>
      <div className={styles.grid}>{cards.map((item, index) => item ? <button type="button" className={styles.storeCard} key={item.store_id} onClick={() => chooseStore(item.store_id)}>
        <div className={styles.storeImage}><Image src={item.store_image || "/motomachi.jpg"} alt="まちやどMotomachi" fill sizes="(max-width: 600px) 50vw, 280px" /></div>
        <div><span>宿泊・地域拠点</span><h3>{item.store_name}</h3><b>500円OFF</b><i>›</i></div>
      </button> : <article className={styles.recruiting} key={`recruiting-${index}`}><small>COMING SOON</small><span>＋</span><h3>参加店舗募集中</h3><p>まちやどMotomachiの<br />宿泊者向け特典に<br />参加しませんか？</p></article>)}</div>
    </section>

    {confirming && store && <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.target === event.currentTarget && setConfirming(false)}><div>
      <span className={styles.modalIcon}>✓</span><p>最終確認</p><h2 id="confirm-title">この店舗でクーポンを<br />使用しますか？</h2><div className={styles.modalOffer}><b>{store.store_name}</b><strong>500円OFF</strong></div>
      <p className={styles.warning}>このクーポンは滞在中に1度だけ利用できます。使用後は他の店舗でも利用できなくなります。</p>
      {message && <p className={styles.error}>{message}</p>}
      <button className={styles.confirmButton} onClick={redeem} disabled={submitting}>{submitting ? "処理中…" : "クーポンを使用する"}</button>
      <button className={styles.backButton} onClick={() => setConfirming(false)} disabled={submitting}>戻る</button>
    </div></div>}
  </main>;
}
