"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

async function waitForSession(maxMs = 4000, step = 100) {
  const limit = Math.ceil(maxMs / step);
  for (let i = 0; i < limit; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

function clearPkceResidue() {
  try {
    localStorage.removeItem("sb-pkce-code-verifier");
    sessionStorage.removeItem("sb-pkce-code-verifier");
    // 念のため全部の sb-* も掃除
    Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k));
    Object.keys(sessionStorage).filter(k => k.startsWith("sb-")).forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

export default function AuthCallbackPage() {
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(location.href);

        // 1) メール（# or ?）
        const hp = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
        const access_token  = hp.get("access_token")  ?? url.searchParams.get("access_token");
        const refresh_token = hp.get("refresh_token") ?? url.searchParams.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token }).catch(console.error);
          if (await waitForSession()) return location.replace("/");
          return location.replace("/login?reason=callback");
        }

        // 2) Google（PKCE）
        if (url.searchParams.has("code")) {
          // まず交換
          const ex: any = (supabase.auth as any)?.exchangeCodeForSession;
          if (typeof ex === "function") {
            const { error } = await ex(location.href);
            if (error) console.error("[callback] exchange error:", error);
          }
          if (await waitForSession()) return location.replace("/");

          // ここで取れん＝code_verifier ロストの可能性 → 一回だけ自動リトライ
          const retriedKey = "__oauth_retry_once__";
          const retried = sessionStorage.getItem(retriedKey) === "1";
          if (!retried) {
            sessionStorage.setItem(retriedKey, "1");
            clearPkceResidue();
            // 再ログイン起動（ユーザー操作なしで1回だけ）
            await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${location.origin}/auth/callback`,
                queryParams: { prompt: "select_account" },
              },
            });
            return; // ここでブラウザ遷移
          }
          // 再試行済みでもダメなら戻す
          return location.replace("/login?reason=callback");
        }

        // 3) 何も無い時（外部ブラウザからの戻りなど）→様子見
        if (await waitForSession()) return location.replace("/");
        location.replace("/login?reason=callback");
      } catch (e) {
        console.error("[callback] fatal:", e);
        location.replace("/login?reason=callback-fatal");
      }
    })();
  }, []);

  return (
    <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <div>ログイン処理中…</div>
    </main>
  );
}
