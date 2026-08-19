/** Brand-neutral bingo line calculation shared by town and habit games. */
export function bingoLines(size: number, cleared: ReadonlySet<number>): number[][] {
  const lines: number[][] = [];
  for (let row = 0; row < size; row++) lines.push(Array.from({ length: size }, (_, col) => row * size + col));
  for (let col = 0; col < size; col++) lines.push(Array.from({ length: size }, (_, row) => row * size + col));
  lines.push(Array.from({ length: size }, (_, index) => index * size + index));
  lines.push(Array.from({ length: size }, (_, index) => index * size + (size - index - 1)));
  return lines.filter((line) => line.every((index) => cleared.has(index)));
}

export function formatElapsed(startTime: string | null, completedAt?: string | null, now = Date.now()) {
  if (!startTime) return "00:00:00";
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const seconds = Math.max(0, Math.floor((end - new Date(startTime).getTime()) / 1000));
  const days = Math.floor(seconds / 86400);
  const time = [Math.floor((seconds % 86400) / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
  return days > 0 ? `${days}day ${time}` : time;
}

export function formatDatedElapsed(startTime: string | null, completedAt?: string | null, now = Date.now()) {
  const end = completedAt ? new Date(completedAt) : new Date(now);
  const date = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(end);
  return `${date} ${formatElapsed(startTime, completedAt, now)}`;
}

export function normalizeAnswer(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP").replace(/\s+/g, "");
}
