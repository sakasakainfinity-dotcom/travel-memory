"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PairingButtons() {
  const [email, setEmail] = useState("");

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
    alert("ログイン用リンクを送ったよ。メールを確認してね。");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    alert("ログアウトしたよ");
  };

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
      <button onClick={logout} style={{ padding: "10px 14px" }}>
        ログアウト
      </button>
    </div>
  );
}





