"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const fn: any = (supabase.auth as any).exchangeCodeForSession;
        const res = fn.length === 1 ? await fn(window.location.href) : await fn();
        if (res?.error) console.error("exchange error:", res.error);
      } catch (e) {
        console.error(e);
      } finally {
        router.replace("/");
      }
    })();
  }, [router]);
  return <p style={{ padding: 16 }}>ログイン処理中…</p>;
}




