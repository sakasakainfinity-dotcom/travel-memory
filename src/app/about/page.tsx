"use client";

import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AboutPage() {
  const [shareUrl, setShareUrl] = useState<string>("");
  const [category, setCategory] = useState<string>("idea");
  const [message, setMessage] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.origin);
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      alert("フィードバック内容を入力してください。");
      return;
    }

    try {
      setSending(true);

      const { data: ses } = await supabase.auth.getSession();
      const userId = ses.session?.user.id ?? null;

      const { error } = await supabase.from("feedbacks").insert({
        user_id: userId,
        category,
        message,
        contact: contact || null,
      });

      if (error) {
        console.error(error);
        alert("送信に失敗しました。時間をおいてもう一度お試しください。");
        return;
      }

      setMessage("");
      setContact("");
      setCategory("idea");
      alert("フィードバックありがとうございます！今後の改善の参考にさせていただきます。");
    } catch (e) {
      console.error(e);
      alert("予期せぬエラーが発生しました。すみません…");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#f9fafb",
        padding: "24px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        {/* 戻る（とりあえずブラウザバック） */}
        <button
          type="button"
          onClick={() => history.back()}
          style={{
            marginBottom: 16,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #475569",
            background: "rgba(15,23,42,0.9)",
            color: "#e2e8f0",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ← 戻る
        </button>

        {/* タイトル */}
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          開発者と宿のご紹介
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#e5e7eb",
            lineHeight: 1.7,
            marginBottom: 20,
          }}
        >
          TripMemory は、茨城の田舎で小さな宿を営みながら、
          「旅の思い出をちゃんと残したい」という想いから生まれたアプリです。
          このページでは、開発者と、運営している宿を紹介します。
        </p>

        {/* 開発者プロフィール */}
        <section
          style={{
            background: "rgba(15,23,42,0.95)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid rgba(148,163,184,0.5)",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            開発者プロフィール
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "#e5e7eb",
              lineHeight: 1.7,
              marginBottom: 10,
            }}
          >
            茨城県で、
            <span style={{ fontWeight: 700 }}>まちやど「Motomachi」</span>
            と
            <span style={{ fontWeight: 700 }}>古民家宿「Tabi湊」</span>
            の2つの宿を運営しながら、  
            旅の写真・思い出・会話を「ちゃんと残せる場所」を作りたくて、
            TripMemory を個人開発しています。
          </p>
          <p
            style={{
              fontSize: 13,
              color: "#e5e7eb",
              lineHeight: 1.7,
              marginBottom: 6,
            }}
          >
            旅行、カメラ、ゲストハウス、AI が好きで、
            「旅の余韻が、チェックアウトで終わらない仕組み」を作るのが目標です。
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#9ca3af",
              lineHeight: 1.6,
            }}
          >
            アプリはまだまだ実験中ですが、  
            みなさんの声をもとに、少しずつ育てていきたいと思っています。
          </p>
        </section>

        {/* 宿紹介 */}
        <section
          style={{
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            運営している宿のご紹介
          </h2>

          {/* まちやど Motomachi */}
          <div
            style={{
              background: "rgba(15,23,42,0.95)",
              borderRadius: 16,
              padding: 14,
              border: "1px solid rgba(148,163,184,0.45)",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              まちやど「Motomachi」（茨城県大子町）
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#e5e7eb",
                lineHeight: 1.7,
                marginBottom: 6,
              }}
            >
              茨城県大子町の商店街の一角にある、小さなゲストハウスです。
              観光の拠点というだけでなく、  
              「町と人がゆるくつながる場所」を目指して、
              長期滞在やリピーターさんにも多く利用いただいています。
            </p>
            <a
              href="https://daigo-machiyado.jp/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 12,
                color: "#bfdbfe",
                textDecoration: "underline",
              }}
            >
              まちやど「Motomachi」の公式サイトを見る
            </a>
          </div>

          {/* 古民家宿 Tabi湊 */}
          <div
            style={{
              background: "rgba(15,23,42,0.95)",
              borderRadius: 16,
              padding: 14,
              border: "1px solid rgba(148,163,184,0.45)",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              古民家宿「Tabi湊」（茨城県ひたちなか市・那珂湊）
            </div>
            <p
              style={{
                fontSize: 12,
                color: "#e5e7eb",
                lineHeight: 1.7,
                marginBottom: 6,
              }}
            >
              那珂湊の港町にある、昭和レトロな一棟貸しの古民家宿です。
              海や市場が近く、BBQや長期滞在、家族や友人との集まりの場として
              利用いただいています。「実家に帰ってきたような安心感」を大事にしています。
            </p>
            <a
              href="https://tabiminatoinn.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 4,
                fontSize: 12,
                color: "#bfdbfe",
                textDecoration: "underline",
              }}
            >
              古民家宿「Tabi湊」の公式サイトを見る
            </a>
          </div>
        </section>

        {/* フィードバックフォーム */}
        <section
          style={{
            background: "rgba(15,23,42,0.98)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid rgba(148,163,184,0.6)",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            アプリの改善アイデア・フィードバック
          </h2>
          <p
            style={{
              fontSize: 12,
              color: "#e5e7eb",
              lineHeight: 1.6,
              marginBottom: 10,
            }}
          >
            「こんな機能が欲しい」「ここが使いづらい」「バグかも？」など、
            なんでも正直に教えてもらえると、とても助かります。
          </p>

          <form onSubmit={handleSubmit}>
            {/* カテゴリ */}
            <label
              style={{
                display: "block",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              種類
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                padding: "6px 8px",
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <option value="idea">機能のアイデア</option>
              <option value="bug">バグ報告</option>
              <option value="ux">使い勝手について</option>
              <option value="other">その他</option>
            </select>

            {/* 本文 */}
            <label
              style={{
                display: "block",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              内容（必須）
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="例）マップの読み込みが遅く感じました／こんな表示があると嬉しい… など"
              style={{
                width: "100%",
                minHeight: 120,
                borderRadius: 8,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                padding: "8px 10px",
                fontSize: 12,
                marginBottom: 10,
              }}
            />

            {/* 連絡先 */}
            <label
              style={{
                display: "block",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              連絡先（任意）
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="返信が欲しい場合はメールアドレスやSNSアカウントなど"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                padding: "8px 10px",
                fontSize: 12,
                marginBottom: 14,
              }}
            />

            <button
              type="submit"
              disabled={sending}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 999,
                border: "none",
                background: sending ? "#4b5563" : "#22c55e",
                color: "#022c22",
                fontWeight: 800,
                fontSize: 14,
                cursor: sending ? "default" : "pointer",
              }}
            >
              {sending ? "送信中…" : "フィードバックを送る"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
