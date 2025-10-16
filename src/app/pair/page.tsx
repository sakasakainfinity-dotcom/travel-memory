'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Pair = { id: string; owner_id: string };

export default function PairPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>読み込み中…</main>}>
      <PairInner />
    </Suspense>
  );
}

function PairInner() {
  const [pair, setPair] = useState<Pair | null>(null);
  const [joining, setJoining] = useState(false);
  const sp = useSearchParams();
  const joinId = sp.get('join'); // 例: /pair?join=PAIR_UUID

  useEffect(() => {
    (async () => {
      const { data: ses } = await supabase.auth.getSession();
      const uid = ses.session?.user.id;
      if (!uid) return;

      // 既に所属しているペア
      const { data } = await supabase
        .from('pair_members')
        .select('pair_id, pairs!inner(id, owner_id)')
        .eq('user_id', uid)
        .maybeSingle();

      if (data) {
        setPair({ id: (data as any).pairs.id, owner_id: (data as any).pairs.owner_id });
        return;
      }

      // 招待リンク参加
      if (joinId) {
        setJoining(true);
        const { error } = await supabase.from('pair_members').insert({ pair_id: joinId, user_id: uid, role: 'member' });
        setJoining(false);
        if (!error) {
          const { data: p } = await supabase.from('pairs').select('id, owner_id').eq('id', joinId).single();
          if (p) setPair(p as any);
        } else {
          alert('参加に失敗しました。リンクが無効かもしれません。');
        }
      }
    })();
  }, [joinId]);

  async function createPair() {
    const { data: ses } = await supabase.auth.getSession();
    const uid = ses.session?.user.id;
    if (!uid) return;

    const { data: p, error } = await supabase.from('pairs').insert({ owner_id: uid }).select('id, owner_id').single();
    if (error) { alert(error.message); return; }
    await supabase.from('pair_members').insert({ pair_id: p!.id, user_id: uid, role: 'owner' });
    setPair(p as Pair);
  }

  if (!pair) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
        <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>ペア連携</h1>
        {joining ? <div>参加処理中…</div> : (
          <>
            <p style={{ color: '#4b5563', marginBottom: 12 }}>まだペアがありません。作成して、相手に招待リンクを送ってください。</p>
            <button onClick={createPair} style={btnPrimary}>ペアを作成</button>
          </>
        )}
      </main>
    );
  }

  const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/pair?join=${pair.id}`;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>ペア連携</h1>
      <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
        <div style={{ marginBottom: 8 }}>ペアID：<code>{pair.id}</code></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input readOnly value={inviteUrl} style={{ flex: 1, minWidth: 240, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }} />
          <button
            onClick={async () => {
              try { await navigator.clipboard.writeText(inviteUrl); alert('招待リンクをコピーしました'); }
              catch { /* noop */ }
            }}
            style={btnLight}
          >コピー</button>
          <a href={`mailto:?subject=Travel%20Memory%20招待&body=${encodeURIComponent(inviteUrl)}`} style={{ ...btnLight as any, display: 'inline-grid', placeItems: 'center' }}>
            メールで送る
          </a>
        </div>
        <p style={{ color: '#6b7280', marginTop: 8 }}>相手がこのリンクでアクセス→「参加」を押すとペアに入ります。</p>
      </div>
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, background: '#111827', color: '#fff', fontWeight: 800, border: '1px solid #111827', cursor: 'pointer'
};
const btnLight: React.CSSProperties = {
  padding: '10px 14px', borderRadius: 10, background: '#fff', color: '#111827', fontWeight: 800, border: '1px solid #ddd', cursor: 'pointer'
};

