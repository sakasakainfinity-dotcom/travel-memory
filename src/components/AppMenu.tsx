"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type AppMenuCurrent = "map" | "municipality-search" | "town-bingo" | "habit-bingo" | "adventure-book" | "share" | "settings";

type AppMenuProps = {
  current?: AppMenuCurrent;
};

type MenuItem = {
  key: AppMenuCurrent;
  label: string;
  href: string;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "map", label: "全国・開拓マップ", href: "/" },
  { key: "municipality-search", label: "市町村検索", href: "/municipalities" },
  { key: "town-bingo", label: "TownBingo", href: "/bingo" },
  { key: "habit-bingo", label: "HabitBingo", href: "/habit" },
  { key: "adventure-book", label: "自分の称号・特典メーター（冒険の書）", href: "/adventure" },
  { key: "share", label: "シェア", href: "/share" },
  { key: "settings", label: "アプリ設定", href: "/about" },
];

export default function AppMenu({ current }: AppMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setLoggedIn(Boolean(data.session));
    };

    void checkSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const navigateTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleAuthAction = async () => {
    if (!loggedIn) {
      navigateTo("/login");
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("ログアウトに失敗しました");
      return;
    }

    setOpen(false);
    router.push("/login");
  };

  return (
    <>
      <button
        type="button"
        aria-label="メニューを開く"
        onClick={() => setOpen(true)}
        style={styles.menuButton}
      >
        ≡
      </button>

      {open && <button aria-label="メニューを閉じる" onClick={() => setOpen(false)} style={styles.overlay} type="button" />}

      <aside
        aria-hidden={!open}
        style={{
          ...styles.panel,
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div style={styles.headerRow}>
          <div style={styles.menuTitle}>photoMapper</div>
          <button type="button" aria-label="閉じる" onClick={() => setOpen(false)} style={styles.closeButton}>
            ×
          </button>
        </div>

        <nav style={styles.nav}>
          {MENU_ITEMS.map((item) => {
            const active = current === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigateTo(item.href)}
                style={{ ...styles.itemButton, ...(active ? styles.activeItem : null) }}
              >
                {item.label}
              </button>
            );
          })}

          <button type="button" onClick={() => void handleAuthAction()} style={styles.itemButton}>
            {loggedIn ? "ログアウト" : "ログイン"}
          </button>
        </nav>
      </aside>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  menuButton: {
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 12px)",
    right: "12px",
    width: 38,
    height: 38,
    borderRadius: 11,
    border: "1px solid #e2e8f0",
    background: "#fff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.15)",
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1,
    zIndex: 75,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    border: "none",
    background: "rgba(0,0,0,0.35)",
    zIndex: 79,
  },
  panel: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: "78vw",
    maxWidth: 320,
    background: "#fff",
    borderLeft: "1px solid #e5e7eb",
    zIndex: 80,
    paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
    paddingLeft: 12,
    paddingRight: 12,
    transition: "transform 180ms ease",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuTitle: {
    fontWeight: 900,
    fontSize: 16,
  },
  closeButton: {
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 10,
    width: 34,
    height: 34,
    fontSize: 22,
    lineHeight: 1,
  },
  nav: {
    display: "grid",
    alignContent: "start",
    gap: 8,
  },
  itemButton: {
    minHeight: 44,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 700,
    fontSize: 14,
  },
  activeItem: {
    background: "#f1f5f9",
  },
};
