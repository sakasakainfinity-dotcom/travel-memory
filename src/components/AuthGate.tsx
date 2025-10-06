// src/components/AuthGate.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s?.user));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (checking) {
    return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center" }}>読み込み中…</main>;
  }
  if (!authed) { router.replace("/login"); return null; }
  return <>{children}</>;
}




