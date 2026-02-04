"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void; // × or とじる（保存しない）
  onNever: () => void; // 今後表示しない（保存する）
};

function isStandalone(): boolean {
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

  // iOSブラウザ判定
  const isCriOS = /CriOS/i.test(ua); // Chrome on iOS
  const isFxiOS = /FxiOS/i.test(ua); // Firefox on iOS
  const isSafari =
    /Safari/i.test(ua) &&
    !isCriOS &&
    !isFxiOS &&
    !/Chrome/i.test(ua) &&
    !/Edg/i.test(ua);

  // Android/PCでのChrome判定（ざっくり）
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);

  return { isIOS, isAndroid, isSafari, isChrome, isCriOS, isFxiOS };
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
        {
          title: "① 下（または上）の『共有』ボタンを押す",
          note: "四角から上向き矢印（↑）のアイコン",
        },
        {
          title: "②『ホーム画面に追加』をタップ",
          note: "見つからない時は下にスクロール（一覧の中にある）",
        },
        {
          title: "③ 右上の『追加』を押す",
          note: "ホーム画面に PhotoMapper のアイコンが増える",
        },
        {
          title: "④ 次回からはホームのアイコンから起動",
          note: "ブラウザよりサクッと開ける（通知は出ない）",
        },
      ];
    }

    // iPhone：Chrome/Firefoxなど（Safariじゃない）
    if (env.isIOS && !env.isSafari) {
      return [
        {
          title: "① iPhoneは『Safari』でやるのが一番確実",
          note: "今のブラウザだと『ホーム画面に追加』が出にくいことがある",
        },
        {
          title: "② このページを Safari で開き直してね",
          note: "（共有 → ホーム画面に追加 → 追加）",
        },
      ];
    }

    // Android：Chrome
    if (env.isAndroid && env.isChrome) {
      return [
        {
          title: "① 右上の『︙』（メニュー）を押す",
          note: "Chromeのメニュー（点が3つ）",
        },
        {
          title: "②『アプリをインストール』or『ホーム画面に追加』を選ぶ",
          note: "端末によって表示名が違うけど、近い文言があるはず",
        },
        {
          title: "③『インストール／追加』を押す",
          note: "ホーム画面にアイコンが追加される",
        },
        {
          title: "④ 次回からはホームのアイコンから起動",
          note: "アプリみたいに使える（通知は出ない）",
        },
      ];
    }

    // PC（Chrome/Edgeなど）
    if (!env.isIOS && !env.isAndroid) {
      return [
        {
          title: "① アドレスバー右側の『インストール』アイコンを探す",
          note: "四角っぽいマークや『インストール』の表示",
        },
        {
          title: "②『インストール』を押す",
          note: "アプリのように起動できる",
        },
      ];
    }

    // fallback
    return [
      {
        title: "ブラウザの共有/メニューから『ホーム画面に追加』を探してね",
        note: "",
      },
    ];
  }, [env]);

  if (!open) return null;

  // すでにPWA起動なら出さない（念のため）
  if (typeof window !== "undefined" && isStandalone()) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(560px, 95vw)",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 24px 90px rgba(0,0,0,0.35)",
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
            borderBottom: "1px solid rgba(15,23,42,0.10)",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: -0.2 }}>
              ホーム画面に追加すると便利
            </div>
            <div style={{ fontSize: 12, color: "rgba(15,23,42,0.65)" }}>
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
              border: "1px solid rgba(15,23,42,0.12)",
              background: "rgba(15,23,42,0.06)",
              color: "rgba(15,23,42,0.9)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: "32px",
            }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "rgba(15,23,42,0.04)",
              fontSize: 12,
              color: "rgba(15,23,42,0.78)",
              lineHeight: 1.35,
            }}
          >
            <span style={{ fontWeight: 900, color: "rgba(15,23,42,0.95)" }}>
              PhotoMapper
            </span>{" "}
            をホーム画面に置くと、写真の記録が続きやすいよ。
          </div>

          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10 }}>
            {steps.map((s, idx) => (
              <li key={idx} style={{ fontSize: 13, lineHeight: 1.35 }}>
                <div style={{ fontWeight: 900 }}>{s.title}</div>
                {s.note ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(15,23,42,0.65)",
                      marginTop: 3,
                    }}
                  >
                    {s.note}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          <div style={{ fontSize: 11, color: "rgba(15,23,42,0.55)" }}>
            ※表示は端末やOSのバージョンで少し違う場合があります
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            borderTop: "1px solid rgba(15,23,42,0.10)",
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <button
            onClick={onNever}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.14)",
              background: "rgba(15,23,42,0.06)",
              color: "rgba(15,23,42,0.85)",
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            今後は表示しない
          </button>

          <button
            onClick={onClose}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(59,130,246,0.28)",
              background: "rgba(59,130,246,0.14)",
              color: "#0f172a",
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 950,
            }}
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}
