"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Space = { id: string };

export default function SharePage() {
  // --- アプリ紹介シェア用 ---
  const [shareUrl, setShareUrl] = useState("");
  const [canWebShare, setCanWebShare] = useState(false);
  const router = useRouter();

  const title = "TripMemory - 旅の思い出を地図に残そう";
  const text = "TripMemoryで旅の軌跡を地図に残して、家族やパートナーと共有しよう📍";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.origin); // アプリURL
      setCanWebShare(typeof navigator !== "undefined" && !!navigator.share);
    }
  }, []);

  async function handleShare(target: "x" | "line" | "instagram" | "threads" | "copy") {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(text);

    try {
      // Instagram / Threads はまず Web Share API を試す
      if (canWebShare && (target === "instagram" || target === "threads")) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      }

      switch (target) {
        case "x": {
          const url = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
          window.open(url, "_blank");
          break;
        }
        case "line": {
          const url = `https://line.me/R/share?text=${encodedText}%20${encodedUrl}`;
          window.open(url, "_blank");
          break;
        }
        case "instagram":
        case "threads": {
          await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
          alert(
            `${
              target === "instagram" ? "Instagram" : "Threads"
            }を開いて貼り付けてシェアしてね！\n必要な文はクリップボードにコピーしておいたよ😊`
          );
          break;
        }
        case "copy": {
          await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
          alert("共有用の文をコピーしました！");
          break;
        }
      }
    } catch (e) {
      console.error(e);
      alert("シェアに失敗したみたい… もう一度試してね🥺");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "#f8fafc",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* ← 戻るボタン */}
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            marginBottom: 12,
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

        {/* ----------------------
            ① アプリ紹介シェア
        ---------------------- */}
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          アプリをシェアしよう！
        </h1>
        <p style={{ color: "#cbd5e1", fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          TripMemory を友だちやパートナーに紹介して、いっしょに旅マップを作ろう！
        </p>

        {/* 共有URL + コピー */}
        <div
          style={{
            background: "#0f172a",
            padding: "14px",
            borderRadius: 12,
            border: "1px solid #334155",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, marginBottom: 4, color: "#94a3b8" }}>
            アプリのURL
          </div>
          <div
            style={{
              background: "#020617",
              border: "1px solid #334155",
              padding: "10px",
              borderRadius: 8,
              fontSize: 13,
              wordBreak: "break-all",
            }}
          >
            {shareUrl}
          </div>
          <button
            onClick={() => handleShare("copy")}
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "#1e293b",
              border: "1px solid #475569",
              color: "#e2e8f0",
              cursor: "pointer",
              width: "100%",
              fontSize: 13,
            }}
          >
            URLと紹介文をコピーする
          </button>
        </div>

        {/* ボタン一覧 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <ShareBtn label="X" emoji="✖️" sub="投稿する" onClick={() => handleShare("x")} />
          <ShareBtn label="LINE" emoji="💬" sub="友だちに送る" onClick={() => handleShare("line")} />
          <ShareBtn label="Instagram" emoji="📸" sub="貼り付けでシェア" onClick={() => handleShare("instagram")} />
          <ShareBtn label="Threads" emoji="🧵" sub="貼り付けでシェア" onClick={() => handleShare("threads")} />
        </div>

        <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.5, marginBottom: 22 }}>
          Instagram / Threads は公式の共有リンクがないため、
          「コピー → アプリに貼り付け」方式になります。
        </p>

        {/* 区切り */}
        <div
          style={{
            height: 1,
            background: "rgba(148,163,184,0.35)",
            margin: "18px 0",
          }}
        />

        {/* ----------------------
            ② マイマップ共有（ログイン時だけ表示）
        ---------------------- */}
        <MyMapShareCard />
      </div>
    </div>
  );
}

function MyMapShareCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");

  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data: ses } = await supabase.auth.getSession();
        const u = ses.session?.user?.id ?? null;
        setUid(u);

        if (!u) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("spaces")
          .select("id")
          .eq("owner_id", u);

        if (error) throw error;

        const list = (data ?? []) as Space[];
        setSpaces(list);
        if (list.length > 0) setSelectedSpaceId(list[0].id);
      } catch (e: any) {
        setErr(e?.message ?? "load error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function safeCopy(text: string) {
  try {
    // iOSやアプリ内ブラウザだと clipboard が無い/拒否されることがある
    if (typeof navigator === "undefined") return false;
    if (!("clipboard" in navigator)) return false;
    // 一部環境で secureContext じゃないと拒否される
    if (typeof window !== "undefined" && !window.isSecureContext) return false;

    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn("clipboard denied:", e);
    return false;
  }
}

  async function createShareLink() {
    if (!selectedSpaceId) {
      setErr("共有するマップ（space）を選んでね");
      return;
    }

    try {
      setBusy(true);
      setErr(null);
      setShareUrl(null);

      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_id: selectedSpaceId }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}

      if (!res.ok) throw new Error(json?.error ?? text ?? `create failed (${res.status})`);

      const token = json?.share_token;
      if (!token) throw new Error("share_token missing");

      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
    } catch (e: any) {
      setErr(e?.message ?? "create share error");
    } finally {
      setBusy(false);
    }
  }

  // 未ログインなら案内だけ出す（ボタンは出さない）
  if (!uid) {
    return (
      <div
        style={{
          background: "#0f172a",
          padding: "14px",
          borderRadius: 12,
          border: "1px solid #334155",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
          マイマップを共有（公開投稿のみ）
        </div>
        <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          ログインすると、このマップをシェアできます。
        <button
          type="button"
          onClick={() => router.push("/login")}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          ログインしてシェアする
        </button>
        <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>あとで</div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#0f172a",
        padding: "14px",
        borderRadius: 12,
        border: "1px solid #334155",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
        マイマップを共有（公開投稿のみ）
      </div>
      <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
        共有リンクを作ると、そのURLを知っとる人があなたの「public投稿」だけ見れます（閲覧のみ）。
      </p>

      {loading ? (
        <div style={{ marginTop: 10, color: "#cbd5e1" }}>読み込み中…</div>
      ) : (
        <>
          <div style={{ fontSize: 11, marginBottom: 6, color: "#94a3b8" }}>
            共有するマップ（space）
          </div>

          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid #475569",
              background: "#020617",
              color: "#e2e8f0",
              fontSize: 13,
            }}
          >
            {spaces.length === 0 ? (
              <option value="">spaceが見つからん</option>
            ) : (
              spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))
            )}
          </select>

          <button
            onClick={createShareLink}
            disabled={busy || spaces.length === 0}
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: busy ? "#334155" : "#1e293b",
              border: "1px solid #475569",
              color: "#e2e8f0",
              cursor: busy ? "not-allowed" : "pointer",
              width: "100%",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {busy ? "共有リンク作成中…" : "マイマップ共有リンクを作成"}
          </button>

          {shareUrl && (
            <div
              style={{
                marginTop: 12,
                background: "#020617",
                border: "1px solid #334155",
                padding: "10px",
                borderRadius: 10,
                wordBreak: "break-all",
              }}
            >
              <div style={{ fontSize: 11, marginBottom: 6, color: "#94a3b8" }}>
                共有URL（コピー済み）
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0" }}>{shareUrl}</div>

              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#1e293b",
                    border: "1px solid #475569",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    width: "100%",
                    fontSize: 13,
                  }}
                >
                  もう一回コピー
                </button>

                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#1e293b",
                    border: "1px solid #475569",
                    color: "#e2e8f0",
                    textAlign: "center",
                    textDecoration: "none",
                    width: "100%",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  共有ページを開く
                </a>
              </div>
            </div>
          )}

          {err && (
            <div style={{ marginTop: 10, color: "#fb7185", fontWeight: 800 }}>
              エラー: {err}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShareBtn({
  label,
  emoji,
  sub,
  onClick,
}: {
  label: string;
  emoji: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: "#1e293b",
        border: "1px solid #475569",
        color: "#f1f5f9",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
        {emoji} {label}
      </div>
      <div style={{ fontSize: 11, color: "#cbd5e1" }}>{sub}</div>
    </button>
  );
}


