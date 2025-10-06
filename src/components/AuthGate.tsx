"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // 末尾スラッシュ無視して判定（/auth/callback/ でもOK）
  const isPublic = useMemo(() => {
    const p = pathname.replace(/\/+$/, "");
    return p === "/login" || p === "/auth/callback";
  }, [pathname]);

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const redirected = useRef(false); // 多重リダイレクト防止

  // Hooks は常に実行（Rules of Hooks 厳守）
  useEffect(() => {
    let mounted = true;

    (async () => {
      // 50ms 間隔で最大 20 回（約 1 秒）様子見 → 初期 null を避ける
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

  // ★ /login と /auth/callback は必ず素通り（ここでは絶対リダイレクトしない）
  if (isPublic) return <>{children}</>;

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



