// src/components/AuthGate.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState<boolean>(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthed(!!data.user);
      setReady(true);

      // ここから遷移ロジック（useEffect内のみ）
      if (!data.user && pathname !== "/login") {
        router.replace("/login");
      }
      if (data.user && pathname === "/login") {
        router.replace("/");
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const ok = !!session?.user;
      setAuthed(ok);
      // 状態が変わったら適切なページへ
      if (ok && pathname === "/login") router.replace("/");
      if (!ok && pathname !== "/login") router.replace("/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  // /login は常に表示（ここでは gate しない）
  if (pathname === "/login") {
    // 既ログインなら上の useEffect で即 "/" に飛ぶ
    return <>{children}</>;
  }

  // それ以外のページは、認証確認が終わるまでローディング
  if (!ready) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <div>読み込み中…</div>
      </main>
    );
  }

  // 未ログインなら何も描画しない（useEffect が /login に飛ばす）
  if (!authed) return null;

  return <>{children}</>;
}
