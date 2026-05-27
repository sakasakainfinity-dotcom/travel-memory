"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
};

export default function PWAInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  const handleInstall = async () => {
    setIsVisible(false);

    if (!deferredEvent) {
      return;
    }

    deferredEvent.prompt();
    await deferredEvent.userChoice;
    setDeferredEvent(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 16,
        background: "#fff",
        borderRadius: 12,
        padding: "10px 14px",
        boxShadow: "0 6px 20px rgba(0,0,0,.12)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        zIndex: 50,
      }}
    >
      <span>ホーム画面に追加できるで！</span>
      <button
        onClick={handleInstall}
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        追加する
      </button>
    </div>
  );
}
