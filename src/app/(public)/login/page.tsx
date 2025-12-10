// src/app/(public)/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");        // 6桁コード
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"request" | "verify">("request"); // ステップ管理

  async function loginWithGoogle() {
    setBusy(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/` },
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      if (mode === "request") {
        // ① 6桁コードをメールで送る
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true, // 必要に応じて false に
          },
        });
        if (error) throw error;

        alert("6桁の認証コードをメールで送ったよ。届いたコードを入力してね。");
        setMode("verify");
      } else {
        // ② 入力された6桁コードでログイン
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type: "email", // email OTP 用
        });
        if (error) throw error;

        // ログイン成功
        alert("ログインできたよ！");
        location.href = "/"; // 好きな遷移先に変更
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "処理に失敗したよ。もう一度試してみて。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* 背景デコ（グラデ＋ノイズ＋発光） */}
      <div style={styles.bgGradient} />
      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />
      <div style={styles.noise} />

      {/* カード */}
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          {/* シンプルな渦ロゴ */}
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <circle
              cx="24"
              cy="24"
              r="22"
              fill="none"
              stroke="url(#g)"
              strokeWidth="2.5"
            />
            <path
              d="M24 10c7 0 12 5 12 12s-5 12-12 12S12 29 12 22"
              fill="none"
              stroke="url(#g)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 style={styles.title}>サインイン</h1>
        <p style={styles.subtitle}>
          ログインすると、地図と投稿機能が使えるようになるよ。
        </p>

        <button
          onClick={loginWithGoogle}
          disabled={busy}
          style={{ ...styles.btn, ...styles.btnPrimary }}
        >
          {busy ? "処理中…" : "Googleでサインイン"}
        </button>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>または</span>
          <span style={styles.dividerLine} />
        </div>

        {/* メール＋OTP フォーム */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
            disabled={busy || mode === "verify"} // コード入力ステップではメール変更ロック
          />

          {mode === "verify" && (
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="6桁のコード"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              style={styles.input}
            />
          )}

          <button
            type="submit"
            disabled={busy || !email}
            style={{ ...styles.btn, ...styles.btnGhost }}
          >
            {busy
              ? "処理中…"
              : mode === "request"
              ? "6桁コードをメールで受け取る"
              : "6桁コードでログイン"}
          </button>
        </form>

        <p style={styles.note}>
          メールに届いた6桁コードを入力するとサインインできるよ。
        </p>
      </div>

      {/* ちょいアニメのCSS */}
      <style jsx>{`
        @keyframes floaty {
          0% {
            transform: translate(-50%, -50%) scale(1);
            filter: blur(60px);
          }
          50% {
            transform: translate(-48%, -52%) scale(1.05);
            filter: blur(80px);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            filter: blur(60px);
          }
        }
      `}</style>
    </div>
  );
}

// 以下 styles はそのまま（元コードからコピー）
const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    minHeight: "100svh",
    overflow: "hidden",
    background:
      "linear-gradient(120deg, #0b1020 0%, #0e1733 60%, #0b1b3f 100%)",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },
  bgGradient: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(1000px 600px at 20% 20%, rgba(56, 189, 248, 0.25), transparent 60%), radial-gradient(900px 600px at 80% 80%, rgba(99, 102, 241, 0.22), transparent 60%)",
    pointerEvents: "none",
  },
  glowOne: {
    position: "absolute",
    top: "40%",
    left: "30%",
    width: 520,
    height: 520,
    background:
      "radial-gradient(circle, rgba(56,189,248,0.35) 0%, rgba(56,189,248,0) 70%)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    animation: "floaty 12s ease-in-out infinite",
    pointerEvents: "none",
  },
  glowTwo: {
    position: "absolute",
    top: "65%",
    left: "70%",
    width: 520,
    height: 520,
    background:
      "radial-gradient(circle, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0) 70%)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    animation: "floaty 14s ease-in-out infinite",
    pointerEvents: "none",
  },
  noise: {
    position: "absolute",
    inset: 0,
    background:
      'url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"120\\" height=\\"120\\" viewBox=\\"0 0 120 120\\"><filter id=\\"n\\"><feTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.8\\" numOctaves=\\"2\\" stitchTiles=\\"stitch\\"/></filter><rect width=\\"120\\" height=\\"120\\" filter=\\"url(%23n)\\" opacity=\\"0.035\\"/></svg>")',
    mixBlendMode: "soft-light",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    width: "min(92vw, 420px)",
    padding: 28,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
    boxShadow:
      "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(12px)",
    color: "#e6eefc",
  },
  logoWrap: { display: "grid", placeItems: "center", marginBottom: 10 },
  title: { fontSize: 24, fontWeight: 800, margin: "4px 0 6px" },
  subtitle: {
    color: "rgba(230,238,252,0.7)",
    margin: "0 0 16px",
    lineHeight: 1.6,
    fontSize: 14,
  },
  btn: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    fontWeight: 800,
    letterSpacing: 0.2,
    cursor: "pointer",
  },
  btnPrimary: {
    background:
      "linear-gradient(90deg, rgba(56,189,248,0.16), rgba(99,102,241,0.16))",
    color: "#eaf2ff",
  },
  btnGhost: {
    background: "rgba(255,255,255,0.06)",
    color: "#eaf2ff",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    outline: "none",
    background: "rgba(0,0,0,0.25)",
    color: "#eaf2ff",
  },
  divider: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
    margin: "14px 0",
  },
  dividerLine: { height: 1, background: "rgba(255,255,255,0.16)" },
  dividerText: { fontSize: 12, color: "rgba(230,238,252,0.6)" },
  note: { marginTop: 10, fontSize: 12, color: "rgba(230,238,252,0.55)" },
};
