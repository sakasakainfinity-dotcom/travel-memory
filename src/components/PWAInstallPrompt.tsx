use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type PromptVariant = "hidden" | "prompt" | "ios";

const INSTALL_PROMPT_DELAY_MS = 1500;

const isClient = () => typeof window !== "undefined";

const detectStandalone = () => {
  if (!isClient()) {
    return false;
  }

  const nav = window.navigator as NavigatorWithStandalone;
  const isStandaloneByNavigator = typeof nav.standalone === "boolean" ? nav.standalone : false;
  const isStandaloneByMedia = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;

  return isStandaloneByNavigator || isStandaloneByMedia;
};

const detectIos = () => {
  if (!isClient()) {
    return false;
  }

  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
};

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [variant, setVariant] = useState<PromptVariant>("hidden");
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (!isClient()) {
      return;
    }

    setIsStandalone(detectStandalone());
    setIsIos(detectIos());

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");

    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsStandalone(event.matches);
      if (event.matches) {
        setVariant("hidden");
      }
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleDisplayModeChange);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(handleDisplayModeChange);
      }
    }

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setVariant("hidden");
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", handleDisplayModeChange);
        } else if (typeof mediaQuery.removeListener === "function") {
          mediaQuery.removeListener(handleDisplayModeChange);
        }
      }

      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isClient()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVariant("prompt");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!isClient()) {
      return;
    }

    if (!isIos || isStandalone) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVariant((current) => (current === "hidden" ? "ios" : current));
    }, INSTALL_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isIos, isStandalone]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();

    try {
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVariant("hidden");
        setDeferredPrompt(null);
      } else {
        setVariant("hidden");
      }
    } catch {
      setVariant("hidden");
    }
  };

  const handleClose = () => {
    setVariant("hidden");
  };

  if (variant === "hidden" || isStandalone) {
    return null;
  }

  const showInstallButton = variant === "prompt" && deferredPrompt;

  return (
    <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4 md:left-auto md:right-6 md:justify-end">
      <div className="pointer-events-auto relative w-full max-w-sm rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-xl shadow-sky-200/60 backdrop-blur">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 text-slate-400 transition hover:text-slate-600"
          aria-label="閉じる"
        >
          ×
        </button>
        <h2 className="text-base font-semibold text-slate-900">ホーム画面に追加しませんか？</h2>
        {variant === "prompt" ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            インストールするとオフラインでも旅の思い出を確認でき、ホーム画面からすぐにアクセスできます。
          </p>
        ) : (
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
            <p>Safariの共有ボタンから「ホーム画面に追加」を選ぶとインストールできます。</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>画面下の共有ボタン（□と↑）をタップ</li>
              <li>「ホーム画面に追加」を選択</li>
            </ol>
          </div>
        )}
        {showInstallButton ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              インストール
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              あとで
            </button>
          </div>
        ) : (
          <div className="mt-4 text-xs text-slate-400">※ iOSでは手動でホーム画面に追加してください。</div>
        )}
      </div>
    </div>
  );
}
