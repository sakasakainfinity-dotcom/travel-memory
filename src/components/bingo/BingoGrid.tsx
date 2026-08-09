import type { ReactNode } from "react";

export default function BingoGrid({ size, cleared, children, onSelect }: {
  size: number; cleared: ReadonlySet<number>; children: ReactNode[]; onSelect?: (index: number) => void;
}) {
  return <div className={`bingo-grid bingo-grid-${size}`} role="grid" aria-label={`${size}×${size} BINGO`}>
    {children.map((child, index) => <button key={index} type="button" role="gridcell" aria-pressed={cleared.has(index)}
      className={`bingo-cell ${cleared.has(index) ? "is-clear" : ""}`} onClick={() => onSelect?.(index)}>{child}</button>)}
  </div>;
}
