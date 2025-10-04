// src/app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // ← 使うだけ。export はしない

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // PKCE の code/state をセッションに交換（必須）
      const { error } = await supabase.auth.exchangeCodeForSession();
      if (error) console.error("exchange error:", error);
      router.replace("/");
    })();
  }, [router]);

  return <p style={{ padding: 16 }}>ログイン処理中…</p>;
}

