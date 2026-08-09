const TOKYO_TIME_ZONE = "Asia/Tokyo";

export function tokyoDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00+09:00`);
  value.setUTCDate(value.getUTCDate() + amount);
  return tokyoDate(value);
}

export function formatJapaneseDate(date: string, weekday = false): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO_TIME_ZONE,
    month: "long",
    day: "numeric",
    ...(weekday ? { weekday: "short" } : {}),
  }).format(new Date(`${date}T12:00:00+09:00`));
}
