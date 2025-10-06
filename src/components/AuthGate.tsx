// ★一時ログ（必要なくなったら消す）
useEffect(() => {
  console.log("[AuthGate] mount");
}, []);

// src/components/AuthGate.tsx（置き換え）
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 50ms間隔で最大20回（約1秒）だけ様子を見る
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session?.user) {
          setAuthed(true);
          setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      // だめなら最後の1回で判定
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s?.user);
    });

    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (checking) {
    return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center" }}>読み込み中…</main>;
  }
  if (!authed) { router.replace("/login"); return null; }
  return <>{children}</>;
}




