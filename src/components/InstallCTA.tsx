'use client';
import { useEffect, useState } from 'react';

export default function InstallCTA() {
  const [prompt, setPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setCanInstall(true);
      // @ts-ignore
      window.plausible?.('install_prompt_shown');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const onClick = async () => {
    if (!prompt) return;
    const { outcome } = await prompt.prompt();
    setPrompt(null);
    setCanInstall(false);
    // @ts-ignore
    window.plausible?.('install_prompt_result', { props: { outcome }});
  };

  if (!canInstall) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2 shadow bg-white/90 backdrop-blur"
    >
      ホーム画面に追加
    </button>
  );
}
