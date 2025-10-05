// src/components/PairingButtons.tsx
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PairingButtons() {
  const [email, setEmail] = useState("");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
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
    await supabase.auth.signOut();
    alert("ログアウトしたよ");
  };

  // ★ 未ログイン時はログインUIのみ、ログイン時はログアウトのみ
  if (!authed) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={loginGoogle} style={{ padding: "10px 14px", fontWeight: 700 }}>
          Googleでログイン
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={loginEmail} style={{ padding: "10px 14px", fontWeight: 700 }}>
            メールでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={logout} style={{ padding: "10px 14px" }}>ログアウト</button>
    </div>
  );
}







