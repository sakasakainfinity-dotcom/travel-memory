// src/app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // supabase-js の版差吸収：引数必要なら href を渡す、不要なら空呼び
        const fn: any = (supabase.auth as any).exchangeCodeForSession;
        const res =
          fn.length === 1
            ? await fn(window.location.href) // 旧シグネチャ
            : await fn();                    // 新シグネチャ

        const error = res?.error;
        if (error) console.error("exchange error:", error);
      } catch (e) {
        console.error(e);
      } finally {
        router.replace("/");
      }
    })();
  }, [router]);

  return <p style={{ padding: 16 }}>ログイン処理中…</p>;
}


