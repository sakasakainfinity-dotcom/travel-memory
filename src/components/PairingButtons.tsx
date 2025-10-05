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
    if (!email) return alert("メールを入れてね");
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    alert("ログイン用リンクを送ったよ。メールを確認して戻ってきて。");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    alert("ログアウトしたよ");
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={loginGoogle}>Googleでログイン</button>
      <input
        type="email"
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ padding: 6 }}
      />
      <button onClick={loginEmail}>メールでログイン</button>
      <button onClick={logout}>ログアウト</button>
    </div>
  );
}




