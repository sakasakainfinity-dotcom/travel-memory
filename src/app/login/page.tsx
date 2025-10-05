"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PairingButtons from "@/components/PairingButtons";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 初回チェック：ログイン済みなら "/" へ
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) router.replace("/");
      setChecking(false);
    });

    // 状態変化を購読：ログインした瞬間に "/" へ
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) router.replace("/");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div>読み込み中…</div>
      </main>
    );
  }

  // 未ログインならサインインUI
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b0f14",
        color: "white",
      }}
    >
      <div
        style={{
          width: "min(520px, 92vw)",
          padding: 24,
          borderRadius: 16,
          background: "#121820",
          boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12 }}>サインイン</h1>
        <p style={{ color: "#9aa4b2", marginTop: 0 }}>
          ログインすると、地図と投稿機能が使えるようになるよ。
        </p>
        <PairingButtons />
      </div>
    </main>
  );
}


