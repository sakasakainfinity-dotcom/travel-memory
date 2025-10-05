"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // ★ /login はゲートを通さない（常に表示）
  if (pathname === "/login") {
    return <>{children}</>;
  }

  useEffect(() => {
    // 初期状態
    supabase.auth.getUser().then(({ data }) => {
      const ok = !!data.user;
      setAuthed(ok);
      setReady(true);
      if (!ok) router.replace("/login");
    });

    // 変化監視
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const ok = !!session?.user;
      setAuthed(ok);
      if (ok) router.replace("/");
      else router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

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
