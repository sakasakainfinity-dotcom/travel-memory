'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onLoad = async () => {
      try {
        // 既に登録があるか確認
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          // すぐ最新版に
          await navigator.serviceWorker.ready;
        } else {
          // 更新チェック
          await reg.update();
        }
      } catch (e) {
        console.error('[SW] register error:', e);
      }
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}

