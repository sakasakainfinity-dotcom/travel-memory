// src/components/AuthGate.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/auth/callback",
]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // ★ 公開ページは常に素通り（/login, /auth/callback）
  if ([...PUBLIC_PATHS].some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const redirected = useRef(false); // ★ 多重リダイレクト防止

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user);
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
      redirected.current = true;       // ★ 一回だけ飛ばす
      router.replace("/login");
    }
    return null;
  }

  return <>{children}</>;
}


