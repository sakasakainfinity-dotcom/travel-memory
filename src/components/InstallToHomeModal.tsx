"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void; // × で閉じる（保存しない）
  onNever: () => void; // 今後表示しない（保存する）
};

function isStandalone(): boolean {
  // iOS Safari: navigator.standalone, others: display-mode
  const w = window as any;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    w.navigator?.standalone === true
  );
}

function detectEnv() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome/i.test(ua) &&
    !/CriOS/i.test(ua) &&
    !/FxiOS/i.test(ua);

  return { isIOS, isAndroid, isChrome, isSafari };
}

export default function InstallToHomeModal({ open, onClose, onNever }: Props) {
  const [env, setEnv] = useState<ReturnType<typeof detectEnv> | null>(null);

  useEffect(() => {
    if (!open) return;
    setEnv(detectEnv());
  }, [open]);

  const steps = useMemo(() => {
  if (!env) return [];

  // iPhone / iPad：Safari
  if (env.isIOS && env.isSafari) {
    return [
      { title: "① 共有ボタンを押す", note: "画面下（または上）の「四角＋↑」アイコン" },
      { title: "②『ホーム画面に追加』をタップ", note: "見つからない時は下へスクロール" },
      { title: "③ 右上の『追加』を押す", note: "ホーム画面に PhotoMapper が増える" },
      { title: "④ 次回からはホームのアイコンから起動", note: "ブラウザより速く開ける" },
    ];
  }

  // iPhone：Chromeなど（Safariじゃない）
  if (env.isIOS && !env.isSafari) {
    return [
      { title: "① まず Safari で開き直してね", note: "iPhoneはSafariが一番確実" },
      { title: "② Safariで『共有 → ホーム画面に追加』", note: "四角＋↑ → ホーム画面に追加" },
    ];
  }

  // Android：Chrome
  if (env.isAndroid && env.isChrome) {
    return [
      { title: "① 右上の『︙』(メニュー) を押す", note: "Chromeのメニュー" },
      { title: "②『アプリをインストール』or『ホーム画面に追加』", note: "端末で表示名が違う場合あり" },
      { title: "③『インストール』/『追加』を押す", note: "ホーム画面にアイコンが追加される" },
      { title: "④ 次回からはホームのアイコンから起動", note: "通知は出ません" },
    ];
  }

  // PC（Chrome/Edge想定）
  if (!env.isIOS && !env.isAndroid) {
    return [
      { title: "① アドレスバー右側のインストールアイコンを探す", note: "小さい『インストール』マーク" },
      { title: "②『インストール』を押す", note: "アプリのように起動できる" },
    ];
  }

  return [
    { title: "ブラウザの共有/メニューから『ホーム画面に追加』を探してね", note: "" },
  ];
}, [env]);
  
  if (!open) return null;

  // すでにPWA（ホームから起動）なら出さないのが基本
  // ※呼び出し側でも判定するけど、念のため二重で守る
  if (typeof window !== "undefined" && isStandalone()) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(560px, 95vw)",
          borderRadius: 18,
          border: "1px solid rgba(148,163,184,0.18)",
          background: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 24px 90px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "14px 14px 12px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid rgba(148,163,184,0.14)",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>
              ホーム画面に追加すると便利
            </div>
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.72)" }}>
              次回からアプリみたいにすぐ開けるよ（通知はしない）
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "rgba(2,6,23,0.35)",
              color: "rgba(226,232,240,0.9)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: "32px",
            }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.14)",
              background: "rgba(2,6,23,0.25)",
              fontSize: 12,
              color: "rgba(226,232,240,0.78)",
            }}
          >
            <span style={{ fontWeight: 800, color: "rgba(226,232,240,0.92)" }}>
              PhotoMapper
            </span>{" "}
            をホーム画面に置くと、写真の記録が続きやすいよ。
          </div>

          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
            {steps.map((s, idx) => (
              <li key={idx} style={{ fontSize: 13, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 800 }}>{s.title}</div>
                {s.note ? (
                  <div style={{ fontSize: 12, color: "rgba(226,232,240,0.7)", marginTop: 2 }}>
                    {s.note}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {/* footer */}
        <div
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            borderTop: "1px solid rgba(148,163,184,0.14)",
            background: "rgba(2,6,23,0.22)",
          }}
        >
          <button
            onClick={onNever}
            style={{
              borderRadius: 12,
              background: "rgba(15,23,42,0.06)",
border: "1px solid rgba(15,23,42,0.14)",
color: "rgba(15,23,42,0.85)",
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            今後は表示しない
          </button>

          <button
            onClick={onClose}
            style={{
              borderRadius: 12,
             background: "rgba(59,130,246,0.14)",
border: "1px solid rgba(59,130,246,0.25)",
color: "#0f172a",
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}
