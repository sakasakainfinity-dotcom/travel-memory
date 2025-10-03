// src/components/PairingButtons.tsx
"use client";

import { useState } from "react";
import { createPairInvite, redeemPairInvite } from "@/lib/spacePairing";

export default function PairingButtons() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  async function onCreate() {
    try {
      setCreating(true);
      const res = await createPairInvite();
      setCreatedCode(res.code);
    } catch (e: any) {
      alert(e?.message ?? e);
    } finally {
      setCreating(false);
    }
  }

  async function onJoin() {
    try {
      setRedeeming(true);
      const res = await redeemPairInvite(code);
      alert("ペア参加できました！ Space: " + res.joinedSpaceId);
      setShowJoin(false);
      setCode("");
    } catch (e: any) {
      alert(e?.message ?? e);
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() => setShowCreate(true)}
        style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
      >
        ペア招待を作成
      </button>
      <button
        onClick={() => setShowJoin(true)}
        style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}
      >
        ペアコードで参加
      </button>

      {/* 招待作成モーダル */}
      {showCreate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2_000_000, display: "grid", placeItems: "center" }}
          onClick={() => setShowCreate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>ペア招待コード</div>
            <p style={{ fontSize: 13, color: "#555" }}>このコードを相手に送ってください（48時間有効・1回のみ使用可能）</p>

            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                readOnly
                value={createdCode ?? ""}
                placeholder="（未発行）"
                style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
              />
              <button
                onClick={onCreate}
                disabled={creating}
                style={{ background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}
              >
                {creating ? "作成中..." : "新規作成"}
              </button>
            </div>

            <div style={{ textAlign: "right", marginTop: 12 }}>
              <button onClick={() => setShowCreate(false)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 8, padding: "8px 12px" }}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 参加モーダル */}
      {showJoin && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2_000_000, display: "grid", placeItems: "center" }}
          onClick={() => setShowJoin(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>ペアコードで参加</div>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例: A7f9K2mQpX"
              style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowJoin(false)} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 8, padding: "8px 12px" }}>
                閉じる
              </button>
              <button
                onClick={onJoin}
                disabled={redeeming || code.trim().length === 0}
                style={{ background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 12px", fontWeight: 700 }}
              >
                {redeeming ? "参加中..." : "参加する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
