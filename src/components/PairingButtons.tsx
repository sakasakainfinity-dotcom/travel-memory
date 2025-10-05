"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PairingButtons() {
  const [email, setEmail] = useState("");
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => mounted && setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const loginGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const loginEmail = async () => {
    if (!email) return alert("メールアドレスを入れてね");
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    alert("ログイン用リンクを送ったよ。メール確認してね。");
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } finally { router.replace("/login"); }
  };

  if (!authed) {
    return (
      <div className="auth-buttons">
        <button className="btn btn-primary w-full" onClick={loginGoogle}>
          Googleでログイン
        </button>

        <div className="auth-row">
          <input
            type="email"
            className="input flex-1"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" onClick={loginEmail}>メールでログイン</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-buttons">
      <button className="btn" onClick={logout}>ログアウト</button>
    </div>
  );
}










