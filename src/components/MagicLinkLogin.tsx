"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MagicLinkLogin({ next = "/", title = "if then bingo" }: { next?: string; title?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const check = await fetch("/api/auth/magic-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await check.json();
    if (!check.ok || !result.eligible) { setMessage("このメールアドレスでは現在利用できません。"); setBusy(false); return; }
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    setMessage(error ? "ログインリンクを送信できませんでした。" : "ログインリンクを送信しました。メールをご確認ください。");
    setBusy(false);
  }

  return <main className="member-login"><form onSubmit={submit}><p className="member-kicker">MEMBER LOGIN</p><h1>{title}</h1><p>メールアドレスでログイン</p><label><span>メールアドレス</span><input required type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)}/></label><button disabled={busy}>{busy ? "送信中…" : "ログインリンクを送る"}</button>{message && <p role="status">{message}</p>}</form></main>;
}
