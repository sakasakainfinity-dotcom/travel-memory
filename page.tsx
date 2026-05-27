"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomeEntryPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session?.user) {
        router.replace("/my");
      } else {
        router.replace("/public");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div>読み込み中…</div>
    </main>
  );
}
