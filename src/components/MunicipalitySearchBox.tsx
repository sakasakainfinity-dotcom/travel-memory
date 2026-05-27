"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { searchMunicipalities, type Municipality } from "@/lib/municipalities";

type MunicipalitySearchBoxProps = {
  items: Municipality[];
  onPick: (item: Municipality) => void;
  placeholder?: string;
  maxResults?: number;
  query?: string;
  onQueryChange?: (value: string) => void;
};

export default function MunicipalitySearchBox({
  items,
  onPick,
  placeholder = "市町村名で検索",
  maxResults = 30,
  query: controlledQuery,
  onQueryChange,
}: MunicipalitySearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const actualQuery = controlledQuery ?? query;
  const filtered = useMemo(() => searchMunicipalities(items, actualQuery, maxResults), [items, maxResults, actualQuery]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} style={styles.root}>
      <input
        value={actualQuery}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (onQueryChange) {
            onQueryChange(nextValue);
          } else {
            setQuery(nextValue);
          }
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={styles.input}
      />

      {open && actualQuery.trim().length >= 2 && filtered.length > 0 && (
        <div style={styles.dropdown}>
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              style={styles.option}
              onClick={() => {
                onPick(item);
                if (onQueryChange) {
                  onQueryChange(item.fullName);
                } else {
                  setQuery(item.fullName);
                }
                setOpen(false);
              }}
            >
              <span style={styles.optionTitle}>{item.city}</span>
              <span style={styles.optionSub}>{item.prefecture}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    width: "100%",
  },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "0 12px",
    fontSize: 14,
    outline: "none",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.08)",
  },
  dropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.12)",
    overflow: "hidden",
    zIndex: 55,
  },
  option: {
    display: "grid",
    width: "100%",
    textAlign: "left",
    border: "none",
    borderBottom: "1px solid #f1f5f9",
    background: "#fff",
    padding: "10px 12px",
    cursor: "pointer",
    gap: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  },
  optionSub: {
    fontSize: 12,
    color: "#64748b",
  },
};
