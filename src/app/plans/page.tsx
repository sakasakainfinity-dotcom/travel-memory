"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PlansPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [uid, setUid] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);

  const price = useMemo(() => ({ amount: 380, unit: "円", period: "月額" }), []);

  // ✅ 追加：ログイン & premium 判定（profiles.is_premium を見る）
  useEffect(() => {
    (async () => {
      try {
        setChecking(true);
        const { data: ses } = await supabase.auth.getSession();
        const id = ses.session?.user?.id ?? null;
        setUid(id);

        if (!id) {
          setIsPremium(false);
          return;
        }

        const { data: prof, error } = await supabase
          .from("profiles")
          .select("is_premium")
          .eq("id", id)
          .single();

        if (error) {
          console.warn("profiles fetch error:", error);
          setIsPremium(false);
          return;
        }
        setIsPremium(!!prof?.is_premium);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const goCheckout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: ses } = await supabase.auth.getSession();
      const id = ses.session?.user?.id;

      if (!id) {
        alert("プレミアム加入にはログインが必要です。ログイン画面へ移動します。");
        router.push("/(public)/login");
        return;
      }

      // ✅ すでにプレミアムなら checkout させない
      if (isPremium) return;

      const res = await fetch("/api/stripe/checkout-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "checkout failed");

      window.location.href = json.url;
    } catch (e: any) {
      console.error(e);
      alert("決済ページの作成に失敗しました: " + (e?.message ?? "unknown"));
    } finally {
      setLoading(false);
    }
  };

  // ✅ 追加：解約（管理）ボタン = Stripe Customer Portalへ飛ばす
  const goManageBilling = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: ses } = await supabase.auth.getSession();
      const id = ses.session?.user?.id;

      if (!id) {
        alert("解約にはログインが必要です。ログイン画面へ移動します。");
        router.push("/(public)/login");
        return;
      }

      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "portal failed");

      window.location.href = json.url; // Stripeの管理画面（解約もここ）
    } catch (e: any) {
      console.error(e);
      alert("管理画面への移動に失敗しました: " + (e?.message ?? "unknown"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "linear-gradient(135deg, #05070c, #0b1220, #060a12)",
        color: "#f8fafc",
        padding: "24px",
      }}
    >
      <style>{`
        .wrap { max-width: 880px; margin: 0 auto; }
        .card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(0,0,0,0.35);
          overflow: hidden;
          backdrop-filter: blur(10px);
        }
        .hero {
          padding: 22px 18px 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.10);
        }
        .title {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.02em;
          margin: 0 0 6px;
        }
        .sub {
          margin: 0;
          color: rgba(226,232,240,0.75);
          font-size: 13px;
          line-height: 1.5;
        }

        .priceBox { text-align: right; }
        .premiumPrice {
          position: relative;
          font-family: ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial;
          font-weight: 900;
          font-size: 42px;
          letter-spacing: -0.02em;
          background: linear-gradient(45deg, #b67b03 0%, #daaf08 45%, #fee9a0 50%, #daaf08 55%, #b67b03 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: inline-block;
          overflow: hidden;
          line-height: 1.0;
        }
        .premiumPrice::after {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0) 40%,
            rgba(255, 255, 255, 0.75) 50%,
            rgba(255, 255, 255, 0) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          animation: shine 3s infinite;
        }
        @keyframes shine {
          0% { left: -150%; }
          30% { left: 150%; }
          100% { left: 150%; }
        }
        .unit { font-size: 18px; margin-left: 6px; font-weight: 800; }
        .tax { margin-top: 3px; font-size: 12px; color: rgba(226,232,240,0.65); }

        .body { padding: 18px; display: grid; gap: 14px; }

        .ctaRow { display: grid; grid-template-columns: 1fr; gap: 10px; }

        .ctaBtn {
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: linear-gradient(135deg, rgba(124,58,237,0.95), rgba(59,130,246,0.85));
          color: white;
          font-weight: 900;
          letter-spacing: -0.01em;
          cursor: pointer;
          box-shadow: 0 14px 40px rgba(0,0,0,0.35);
          transition: transform .12s ease, filter .12s ease, opacity .12s ease;
        }
        .ctaBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .ctaBtn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* ✅ 追加：加入済みボタン風（押せない） */
        .ctaDone {
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.10);
          color: rgba(226,232,240,0.92);
          font-weight: 900;
          letter-spacing: -0.01em;
          cursor: default;
        }

        /* ✅ 追加：解約ボタン（赤系、でも上品） */
        .dangerBtn {
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(248,113,113,0.55);
          background: rgba(248,113,113,0.14);
          color: rgba(254,226,226,0.95);
          font-weight: 900;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: transform .12s ease, filter .12s ease, opacity .12s ease;
        }
        .dangerBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .dangerBtn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .fine { color: rgba(226,232,240,0.70); font-size: 12px; line-height: 1.55; }

        .tableWrap { overflow: hidden; border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); }
        table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.04); }
        th, td { padding: 14px 10px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
        th { font-size: 13px; color: rgba(226,232,240,0.85); }
        .feature { text-align: left; font-weight: 800; color: rgba(226,232,240,0.92); width: 44%; }
        .freeHead { background: rgba(255,255,255,0.04); }
        .premiumHead { background: rgba(59,130,246,0.22); font-weight: 900; }
        .small { display:block; margin-top: 4px; font-size: 11px; color: rgba(226,232,240,0.65); font-weight: 600; }
        .highlightText { color: #60a5fa; font-weight: 900; font-size: 18px; }
        .yes {
          background: linear-gradient(135deg, #b67b03 0%, #daaf08 45%, #fee9a0 50%, #daaf08 55%, #b67b03 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 34px;
          font-weight: 900;
          line-height: 1;
          display: inline-block;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));
        }
        .no { color: #fb7185; font-size: 34px; font-weight: 900; line-height: 1; display: inline-block; }

        .notice {
          padding: 12px 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.04);
          color: rgba(226,232,240,0.80);
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 520px){
          .hero { grid-template-columns: 1fr; text-align: left; }
          .priceBox { text-align: left; }
          .premiumPrice { font-size: 36px; }
          .unit { font-size: 16px; }
          .feature { width: 48%; }
          .highlightText { font-size: 16px; }
        }
      `}</style>

      <div className="wrap">
        <div className="card">
          <div className="hero">
            <div>
              <h1 className="title">プレミアムプラン</h1>
              <p className="sub">
                写真のEXIFを自動で読み取って、地図ピン・撮影日時・カメラ情報まで一気に反映。
                <br />
                “旅の記録が面倒”を、ぶち壊すやつ。
              </p>
            </div>

            <div className="priceBox">
              <div className="premiumPrice">
                {price.period}
                {price.amount}
                <span className="unit">{price.unit}</span>
              </div>
              <div className="tax">（税込）</div>
            </div>
          </div>

          <div className="body">
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th className="feature">機能</th>
                    <th className="freeHead">無料</th>
                    <th className="premiumHead">プレミアム</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="feature">写真投稿・閲覧</td>
                    <td>
                      <span className="yes">○</span>
                      <span className="small">制限なし</span>
                    </td>
                    <td>
                      <span className="yes">○</span>
                      <span className="small">制限なし</span>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature">
                      リスト登録数
                      <span className="small">(☆行きたい / ☑行った)</span>
                    </td>
                    <td style={{ fontSize: 13, color: "rgba(226,232,240,0.8)", fontWeight: 800 }}>
                      25個まで
                    </td>
                    <td>
                      <span className="highlightText">無制限</span>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature">自動投稿機能</td>
                    <td style={{ fontSize: 13, color: "rgba(226,232,240,0.8)", fontWeight: 800 }}>
                      1日1回無料
                    </td>
                    <td>
                      <span className="highlightText">EXIF自動投稿 無制限</span>
                    </td>
                  </tr>

                  <tr>
                    <td className="feature">マイマップシェア</td>
                    <td>
                      <span className="no">×</span>
                    </td>
                    <td>
                      <span className="yes">○</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ctaRow">
              {/* ✅ 出し分け：加入済みなら押せない表示 */}
              {checking ? (
                <div className="ctaDone">状態を確認中…</div>
              ) : isPremium ? (
                <>
                  <div className="ctaDone">✅ プレミアムプラン加入済み</div>
                  <button className="dangerBtn" onClick={goManageBilling} disabled={loading}>
                    {loading ? "管理画面へ移動中…" : "解約 / お支払い管理"}
                  </button>
                </>
              ) : (
                <button className="ctaBtn" onClick={goCheckout} disabled={loading}>
                  {loading ? "決済ページへ移動中…" : "プレミアムに加入する"}
                </button>
              )}

              {!uid && !checking && (
                <div className="notice">
                  ※ ログインしてないと加入/解約はできんよ。先にログインしてね。
                </div>
              )}

              <div className="notice">
                ※ 無料は「自動投稿 1日1回」。2回目以降はプラン画面へ案内されます。<br />
                ※ 位置情報が無い写真でも、日時・機種などは自動で入ります（ピンは手動でOK）。
              </div>

              <div className="fine">
                解約はいつでもOK。次回更新日前に解約すれば翌月課金は発生しません（Stripeの仕様に準拠）。
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 14 }} />

        <button
          onClick={() => router.back()}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(226,232,240,0.85)",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          戻る
        </button>
      </div>
    </div>
  );
}
