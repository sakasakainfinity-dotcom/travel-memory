"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PairingButtons() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => mounted && setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

 const clearPkceResidue = () => {
  try {
    localStorage.removeItem("sb-pkce-code-verifier");
    sessionStorage.removeItem("sb-pkce-code-verifier");
    Object.keys(localStorage).filter(k=>k.startsWith("sb-")).forEach(k=>localStorage.removeItem(k));
    Object.keys(sessionStorage).filter(k=>k.startsWith("sb-")).forEach(k=>sessionStorage.removeItem(k));
  } catch {}
};

const loginGoogle = async () => {
  try {
    setLoadingGoogle(true);
    await supabase.auth.signOut();   // 古いセッションを確実に捨てる
    clearPkceResidue();              // PKCEの残骸も掃除

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" }, // アカウント選択は毎回出す
      },
    });
  } catch (e) {
    console.error(e);
    alert("Googleログインでエラー。少し間を置いてもう一度ためして。");
  } finally {
    setLoadingGoogle(false);
  }
};

  const loginEmail = async () => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return alert("メールアドレスを入れてね");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return alert("メールの形式がおかしいよ");

  try {
    setSendingEmail(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      // ★コールバック不要：emailRedirectTo を渡さない
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    setSent(true);
    alert("6桁コードを送ったよ。メールの本文の『コード』をここに入力してね。");
  } catch (e) {
    console.error(e);
    alert("メール送信に失敗したみたい。アドレスを確認して、もう一度ためして。");
  } finally {
    setSendingEmail(false);
  }
};

const verifyCode = async () => {
  const normalized = email.trim().toLowerCase();
  const t = code.trim();
  if (!normalized) return alert("まずメールアドレスを入れて送信してね");
  if (!/^\d{6}$/.test(t)) return alert("6桁のコードを入れてね");

  try {
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: t,
      type: "email",       // ★これが大事
    });
    if (error) throw error;
    window.location.replace("/");  // ハード遷移で確実に反映
  } catch (e) {
    console.error(e);
    alert("コードが違うか期限切れじゃ。メールを再送してやり直して。");
  } finally {
    setVerifying(false);
  }
};

  const logout = async () => {
    try { await supabase.auth.signOut(); } finally { router.replace("/login"); }
  };

  if (!authed) {
    return (
      <div className="auth-buttons">
        <button className="btn btn-primary w-full" onClick={loginGoogle} disabled={loadingGoogle} aria-busy={loadingGoogle}>
          {loadingGoogle ? "処理中…" : "Googleでログイン"}
        </button>

        <div className="auth-row">
          <input
            type="email"
            className="input flex-1"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sendingEmail || verifying}
            inputMode="email"
            autoComplete="email"
          />
          <button className="btn" onClick={loginEmail} disabled={sendingEmail} aria-busy={sendingEmail}>
            {sendingEmail ? "送信中…" : sent ? "メール再送" : "メールでログイン"}
          </button>
        </div>

        {sent && (
          <div className="auth-row" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="6桁コード"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={verifying}
            />
            <button className="btn" onClick={verifyCode} disabled={verifying}>
              {verifying ? "検証中…" : "コードでログイン"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auth-buttons">
      <button className="btn" onClick={logout}>ログアウト</button>
    </div>
  );
}














