"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // ★ /login と /auth/callback は必ず素通り（ゲート対象外）
  const isPublic = pathname === "/login" || pathname === "/auth/callback";
  if (isPublic) {
    return <>{children}</>;
  }

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


