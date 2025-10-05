// src/components/AuthGate.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  // ★ どんなルートでも最初に必ずフックを呼ぶ（これが大事）
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // 公開ページ（ゲート対象外）
  const isPublic = pathname === "/login" || pathname === "/auth/callback";

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const ok = !!data.user;
      setAuthed(ok);
      setReady(true);

      if (!ok && !isPublic) router.replace("/login");
      if (ok && pathname === "/login") router.replace("/");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const ok = !!session?.user;
      setAuthed(ok);
      if (ok && pathname === "/login") router.replace("/");
      if (!ok && !isPublic) router.replace("/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname, isPublic]);

  // ★ ここから“描画”の分岐（フック呼んだ後）
  if (isPublic) return <>{children}</>;

  if (!ready) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div>読み込み中…</div>
      </main>
    );
  }

  if (!authed) return null;

  return <>{children}</>;
}


