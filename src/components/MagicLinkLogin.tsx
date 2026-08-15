"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function MagicLinkLogin({ next = "/", title = "if then bingo" }: { next?: string; title?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (codeSent) {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) { setMessage("確認コードが正しくないか、有効期限が切れています。"); setBusy(false); return; }
      await supabase.rpc("touch_member_login");
      location.replace(safeNext);
      return;
    }
    const check = await fetch("/api/auth/magic-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = await check.json();
    if (!check.ok || !result.eligible) { setMessage("このメールアドレスでは現在利用できません。"); setBusy(false); return; }
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error) setMessage("確認コードを送信できませんでした。");
    else { setCodeSent(true); setMessage("メールに届いた6桁の確認コードを入力してください。"); }
    setBusy(false);
  }

  return <main className="member-login"><form onSubmit={submit}><p className="member-kicker">MEMBER LOGIN</p><h1>{title}</h1><p>{codeSent ? "6桁の確認コードでログイン" : "メールアドレスでログイン"}</p><label><span>メールアドレス</span><input required readOnly={codeSent} type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)}/></label>{codeSent && <label><span>確認コード</span><input autoFocus required type="text" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}/></label>}<button disabled={busy}>{busy ? "確認中…" : codeSent ? "ログインする" : "確認コードを送る"}</button>{codeSent && <button className="member-login-back" type="button" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }}>メールアドレスを変更</button>}{message && <p role="status">{message}</p>}</form></main>;
}
