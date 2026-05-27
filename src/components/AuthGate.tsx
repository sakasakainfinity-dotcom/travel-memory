"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // 末尾スラッシュ無視して判定（/auth/callback/ でもOK）
  const normalizedPath = useMemo(() => {
    const p = pathname.replace(/\/+$/, "");
      return p || "/";
  }, [pathname]);

   // allowlist: ここで定義したパスは未ログインでも通す
  const isPublicPath = useMemo(() => {
    if (normalizedPath === "/public") return true;
    if (normalizedPath === "/login") return true;
    if (normalizedPath === "/auth/callback") return true;
    if (normalizedPath === "/_offline") return true;
    if (normalizedPath === "/manifest.webmanifest") return true;

    // Next.js static assets（念のため）
    if (normalizedPath.startsWith("/_next/")) return true;
    if (normalizedPath.startsWith("/icons/")) return true;
    if (normalizedPath === "/favicon.ico") return true;
    if (normalizedPath === "/apple-touch-icon.png") return true;
    return false;
  }, [normalizedPath]);

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

 // allowlist 対象は必ず素通り（ここでは絶対リダイレクトしない）
  if (isPublicPath) return <>{children}</>;

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



