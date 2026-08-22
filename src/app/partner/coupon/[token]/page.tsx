"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./partner-coupon.module.css";

type Report = { storeName: string; counts: { today: number; month: number; total: number }; usages: Array<{ id: string; used_at: string; coupons: { title: string } | null }> };

export default function PartnerCouponPage({ params }: { params: { token: string } }) {
  const endpoint = `/api/partner/coupon/${encodeURIComponent(params.token)}`;
  const [state, setState] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [pin, setPin] = useState(""); const [message, setMessage] = useState(""); const [report, setReport] = useState<Report | null>(null); const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (response.status === 401) { setState("login"); return; }
    if (!response.ok) { setState("error"); return; }
    setReport(await response.json()); setState("ready");
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function authenticate(event: FormEvent) {
    event.preventDefault(); if (submitting) return; setSubmitting(true); setMessage("");
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    if (response.ok) { setPin(""); await load(); } else setMessage((await response.json()).error ?? "認証できませんでした。");
    setSubmitting(false);
  }
  async function logout() { await fetch(endpoint, { method: "DELETE" }); setReport(null); setState("login"); }
  if (state === "loading") return <main className={styles.center}>確認しています…</main>;
  if (state === "error") return <main className={styles.center}>ページを表示できませんでした。</main>;
  if (state === "login") return <main className={styles.center}><form className={styles.login} onSubmit={authenticate}><span>PhotoMapper 宿泊者特典</span><h1>店舗スタッフ確認</h1><p>店舗へお知らせしたPINを入力してください。</p><label>PIN<input autoFocus inputMode="numeric" autoComplete="one-time-code" minLength={4} maxLength={32} required type="password" value={pin} onChange={event => setPin(event.target.value)} /></label>{message && <p className={styles.error} role="alert">{message}</p>}<button disabled={submitting}>{submitting ? "確認中…" : "実績を確認する"}</button></form></main>;
  if (!report) return null;
  return <main className={styles.shell}><header><div><span>PhotoMapper 宿泊者特典</span><h1>{report.storeName}</h1><p>クーポン利用実績</p></div><button onClick={logout}>ログアウト</button></header><section className={styles.counts}><article><span>本日</span><strong>{report.counts.today}<small>件</small></strong></article><article><span>今月</span><strong>{report.counts.month}<small>件</small></strong></article><article><span>累計</span><strong>{report.counts.total}<small>件</small></strong></article></section><section className={styles.recent}><h2>最近の利用</h2>{report.usages.length === 0 ? <p>利用履歴はまだありません。</p> : <div>{report.usages.map(usage => <article key={usage.id}><time>{new Date(usage.used_at).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time><strong>{usage.coupons?.title ?? "宿泊者向けクーポン"}</strong></article>)}</div>}</section><footer>利用者の個人情報は店舗には表示されません。</footer></main>;
}
