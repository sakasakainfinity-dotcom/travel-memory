"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 初期ユーザー取得
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      setReady(true);
      if (!data.user && pathname !== "/login") router.replace("/login");
    });
    // 状態変化購読（ログイン/ログアウトで即反映）
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const ok = !!session?.user;
      setAuthed(ok);
      if (ok && pathname === "/login") router.replace("/");
      if (!ok && pathname !== "/login") router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  if (!ready) {
    return (
      <main style={{display:"grid",placeItems:"center",height:"100vh"}}>
        <div>読み込み中…</div>
      </main>
    );
  }

  if (!authed) {
    // /login への遷移待ちで一瞬表示
    return null;
  }

  return <>{children}</>;
}
