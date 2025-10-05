"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // 初期取得
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    // 変化を購読（ログイン/ログアウトしたらUIが即更新される）
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div style={{ fontSize: 12, color: "#666" }}>
      {email ? `Logged in: ${email}` : "Not logged in"}
    </div>
  );
}
