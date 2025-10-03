"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  useEffect(() => {
    let done = false;

    (async () => {
      try {
        // ハッシュにアクセストークンがある場合、supabase-js が自動処理する
        // 念のためここで getSession を叩いて、セッション確定まで待つ
        const { data } = await supabase.auth.getSession();

        // セッション取れた/取れなくても、最終的に / へ戻す（ループ防止のため最大3秒）
        const back = () => {
          if (done) return;
          done = true;
          window.location.replace("/");
        };

        if (data.session) {
          back();
        } else {
          // ちょい待っても来ない時用のタイムアウト
          setTimeout(back, 1000);
        }
      } catch {
        // 失敗しても戻す（ここで詰ませない）
        window.location.replace("/");
      }
    })();

    // セーフティ（どんな状況でも3秒で戻す）
    const tid = setTimeout(() => {
      if (!done) window.location.replace("/");
    }, 3000);
    return () => clearTimeout(tid);
  }, []);

  return (
    <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <div>サインイン完了中…</div>
    </main>
  );
}
