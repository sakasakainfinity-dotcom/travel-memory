'use client';
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function KebabMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 10px)', right: 'max(12px, env(safe-area-inset-right, 0px))', zIndex: 11000 }}>
      {/* 3点ボタン */}
      <button
        aria-label="メニュー"
        onClick={() => setOpen(v => !v)}
        style={{
          width: 40, height: 40,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid #ddd',
          boxShadow: '0 4px 16px rgba(0,0,0,.08)',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          backdropFilter: 'saturate(120%) blur(6px)',
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>⋮</span>
      </button>

      {/* メニュー本体 */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 48, right: 0,
            width: 260,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 20px 40px rgba(0,0,0,.18)',
            overflow: 'hidden'
          }}
        >
          <MenuItem href="/history" onClick={() => setOpen(false)}>投稿履歴</MenuItem>
          <MenuItem href="/plans" onClick={() => setOpen(false)}>有料プラン申し込み</MenuItem>
          <MenuItem href="/ai-trip" onClick={() => setOpen(false)}>AI旅行計画</MenuItem>
          <MenuItem href="/pilgrimage" onClick={() => setOpen(false)}>巡礼マップ一覧</MenuItem>
          <MenuItem href="/pair" onClick={() => setOpen(false)}>ペア連携</MenuItem>
          <MenuItem href="/share" onClick={() => setOpen(false)}>シェア</MenuItem>
          <hr style={{ margin: 0, border: 0, borderTop: '1px solid #eee' }} />
          <button
            onClick={async () => {
              try {
                const { supabase } = await import('@/lib/supabaseClient');
                await supabase.auth.signOut();
              } finally {
                setOpen(false);
                window.location.href = '/login';
              }
            }}
            style={itemStyle(true)}
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} style={itemStyle()}>
      {children}
    </Link>
  );
}

function itemStyle(danger = false): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    fontWeight: 700,
    color: danger ? '#ef4444' : '#111827',
    textDecoration: 'none',
    background: '#fff',
  };
}
