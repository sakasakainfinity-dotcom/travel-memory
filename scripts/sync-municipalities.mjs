#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  console.error("Missing source file path. Usage: node scripts/sync-municipalities.mjs /path/to/localgovjp.json");
  process.exit(1);
}

const toSlug = (value) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const PREF_ROMAJI = {
  "北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi", "秋田県": "akita", "山形県": "yamagata", "福島県": "fukushima",
  "茨城県": "ibaraki", "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama", "千葉県": "chiba", "東京都": "tokyo", "神奈川県": "kanagawa",
  "新潟県": "niigata", "富山県": "toyama", "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano",
  "岐阜県": "gifu", "静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie", "滋賀県": "shiga", "京都府": "kyoto", "大阪府": "osaka", "兵庫県": "hyogo", "奈良県": "nara", "和歌山県": "wakayama",
  "鳥取県": "tottori", "島根県": "shimane", "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi",
  "徳島県": "tokushima", "香川県": "kagawa", "愛媛県": "ehime", "高知県": "kochi",
  "福岡県": "fukuoka", "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto", "大分県": "oita", "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa",
};

const sourceRaw = await readFile(sourcePath, "utf8");
const source = JSON.parse(sourceRaw);

const municipalities = source.map((row) => {
  const prefecture = String(row.pref).trim();
  const city = String(row.city).replace(/\s+/g, "").trim();
  const prefSlug = PREF_ROMAJI[prefecture] ?? toSlug(prefecture);
  const citySlug = toSlug(city);

  return {
    id: `${prefSlug}-${citySlug}`,
    prefecture,
    city,
    fullName: `${prefecture}${city}`,
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
});

const deduped = Array.from(new Map(municipalities.map((m) => [m.id, m])).values());

await writeFile("src/lib/municipalities.json", `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
console.log(`Wrote ${deduped.length} municipalities to src/lib/municipalities.json`);
