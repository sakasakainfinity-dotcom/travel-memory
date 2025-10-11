'use client';
import { useEffect, useState } from 'react';

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();       // Android系の beforeinstallprompt を横取り
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 16, background: '#fff', borderRadius: 12, padding: '10px 14px',
      boxShadow: '0 6px 20px rgba(0,0,0,.12)', display: 'flex', gap: 8, alignItems: 'center', zIndex: 50
    }}>
      <span>ホーム画面に追加できるで！</span>
      <button
        onClick={async () => {
          setShow(false);
          if (!deferred) return;
          deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
        style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
      >
        追加する
      </button>
    </div>
  );
}

