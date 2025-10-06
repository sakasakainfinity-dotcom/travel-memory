// src/components/AuthGate.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // 末尾スラッシュを無視して判定（/auth/callback/ でもOK）
  const isPublic = useMemo(() => {
    const p = pathname.replace(/\/+$/, "");
    return p === "/login" || p === "/auth/callback";
  }, [pathname]);

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const redirected = useRef(false); // 多重リダイレクト防止

  // ★ Hooks は常に実行（Rules of Hooks厳守）
  useEffect(() => {
    let mounted = true;

    (async () => {
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

  // ★ /login と /auth/callback は常に素通り（ここで絶対リダイレクトしない）
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



