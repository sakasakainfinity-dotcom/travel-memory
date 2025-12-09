"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type UserInfo = {
  email: string | null;
  displayName: string;
  createdAt: string | null;
};

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [displayName, setDisplayName] = useState("");

  // ログインユーザー情報を取得
  useEffect(() => {
    (async () => {
      try {
        const { data: ses } = await supabase.auth.getSession();
        const session = ses.session;
        if (!session) {
          // 未ログインならログインページへ
          router.push("/login");
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.push("/login");
          return;
        }

        const u = data.user;

        const displayNameFromMeta =
          (u.user_metadata as any)?.display_name ||
          (u.user_metadata as any)?.name ||
          "";

        const info: UserInfo = {
          email: u.email ?? null,
          displayName: displayNameFromMeta,
          createdAt: u.created_at ?? null,
        };

        setUserInfo(info);
        setDisplayName(info.displayName);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function handleSave() {
    if (!userInfo) return;
    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
        },
      });
      if (error) {
        console.error(error);
        alert("保存に失敗しました。時間をおいてもう一度試してみてください。");
        return;
      }
      setUserInfo((prev) =>
        prev ? { ...prev, displayName } : prev
      );
      alert("表示名を更新しました！");
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。ごめん、もう一度試してみて…");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          color: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        読み込み中…
      </div>
    );
  }

  if (!userInfo) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f172a",
          color: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        アカウント情報が取得できませんでした。
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e5e7eb",
        padding: "20px 16px 40px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        {/* 戻るボタン */}
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            marginBottom: 14,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #475569",
            background: "rgba(15,23,42,0.9)",
            color: "#e2e8f0",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ← マップに戻る
        </button>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          アカウント設定
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#cbd5e1",
            marginBottom: 18,
            lineHeight: 1.6,
          }}
        >
          TripMemory のアカウント情報を確認・変更できます。
        </p>

        {/* 基本情報 */}
        <section
          style={{
            background: "rgba(15,23,42,0.95)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid rgba(148,163,184,0.5)",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            ログイン情報
          </h2>

          <div
            style={{
              fontSize: 13,
              marginBottom: 6,
            }}
          >
            <span style={{ color: "#9ca3af" }}>メールアドレス：</span>
            <span>{userInfo.email ?? "（未設定）"}</span>
          </div>

          {userInfo.createdAt && (
            <div
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginTop: 4,
              }}
            >
              登録日：{new Date(userInfo.createdAt).toLocaleString()}
            </div>
          )}
        </section>

        {/* 表示名変更 */}
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
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            表示名（ニックネーム）
          </h2>
          <p
            style={{
              fontSize: 12,
              color: "#cbd5e1",
              marginBottom: 8,
            }}
          >
            今後、アプリ内で表示するときに使う名前です。
          </p>

          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例：かずき、Motomachi管理人 など"
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid #4b5563",
              background: "#020617",
              color: "#e5e7eb",
              padding: "8px 10px",
              fontSize: 13,
              marginBottom: 10,
            }}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "none",
              background: saving ? "#4b5563" : "#22c55e",
              color: "#022c22",
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "保存中…" : "表示名を保存する"}
          </button>
        </section>

        {/* ログアウト */}
        <section
          style={{
            background: "rgba(15,23,42,0.95)",
            borderRadius: 16,
            padding: 16,
            border: "1px solid rgba(148,163,184,0.5)",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 10,
              color: "#fecaca",
            }}
          >
            ログアウト
          </h2>
          <p
            style={{
              fontSize: 12,
              color: "#fca5a5",
              marginBottom: 10,
            }}
          >
            この端末から TripMemory のログイン状態を解除します。
          </p>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #f87171",
              background: "#7f1d1d",
              color: "#fee2e2",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ログアウトする
          </button>
        </section>
      </div>
    </div>
  );
}
