"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const redirected = useRef(false); // 多重リダイレクト防止

  // ★一時ログ（不要になったら消してOK）
  useEffect(() => {
    console.log("[AuthGate] mount");
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // 50ms 間隔で最大 20 回（約 1 秒）だけ様子を見る
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
      // だめなら最後の 1 回で判定
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAuthed(!!s?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div>読み込み中…</div>
      </main>
    );
  }

  if (!authed) {
    if (!redirected.current) {
      redirected.current = true;
      router.replace("/login");
    }
    return null;
  }

  return <>{children}</>;
}




