'use client';
import { useEffect, useState } from 'react';

export default function SWUpdater() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      const check = () => { if (reg.waiting) setWaiting(reg.waiting); };
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) check();
        });
      });
      check();
    });
  }, []);

  const reloadNow = () => {
    waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  if (!waiting) return null;
  return (
    <div className="fixed bottom-4 right-4 rounded-xl bg-black text-white px-4 py-2 shadow">
      新しいバージョンが利用可 👉 <button onClick={reloadNow} className="underline">再読み込み</button>
    </div>
  );
}
