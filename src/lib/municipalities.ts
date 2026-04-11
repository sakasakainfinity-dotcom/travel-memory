import rawMunicipalities from "./municipalities.json";

export type Municipality = {
  id: string;
  prefecture: string;
  city: string;
  fullName: string;
  lat: number;
  lng: number;
};

type MunicipalityInput = Partial<Municipality> & {
  pref?: string;
};

// NOTE:
// 将来的に世界対応する時は `GeoUnit` のような上位型に拡張し、
// kind: "country" | "state" | "prefecture" | "municipality" を持たせる想定。
// 今回は日本の市町村ゲームを優先し Municipality 型のまま維持する。

type MunicipalitySearchIndex = {
  item: Municipality;
  normalized: string;
};

const normalizeSearchText = (value: string): string => value.trim().toLowerCase();
const normalizeSlug = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");

function toMunicipality(input: MunicipalityInput, index: number): Municipality | null {
  const prefecture = String(input.prefecture ?? input.pref ?? "").trim();
  const city = String(input.city ?? "").replace(/\s+/g, "").trim();
  const lat = Number(input.lat);
  const lng = Number(input.lng);

  if (!prefecture || !city || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return {
    id: String(input.id ?? `${normalizeSlug(prefecture)}-${normalizeSlug(city)}-${index}`),
    prefecture,
    city,
    fullName: String(input.fullName ?? `${prefecture}${city}`),
    lat,
    lng,
  };
}

function normalizeMunicipalities(input: MunicipalityInput[]): Municipality[] {
  const normalized = input.map(toMunicipality).filter((item): item is Municipality => item !== null);
  const deduped = Array.from(new Map(normalized.map((item) => [item.id, item])).values());
  return deduped;
}

export const MUNICIPALITIES: Municipality[] = normalizeMunicipalities(rawMunicipalities as MunicipalityInput[]);


const EXPECTED_MIN_MUNICIPALITIES = 1700;
if (process.env.NODE_ENV !== "production" && MUNICIPALITIES.length < EXPECTED_MIN_MUNICIPALITIES) {
  console.warn(
    `[municipalities] dataset seems incomplete: ${MUNICIPALITIES.length} entries. ` +
      `Run scripts/sync-municipalities.mjs with a full source dataset.`
  );
}

const MUNICIPALITY_SEARCH_INDEX: MunicipalitySearchIndex[] = MUNICIPALITIES.map((item) => ({
  item,
  normalized: [item.fullName, item.prefecture, item.city].map(normalizeSearchText).join("\n"),
}));

export function searchMunicipalities(items: Municipality[], query: string, limit = 30): Municipality[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const normalizedLimit = Math.max(1, Math.min(limit, 50));
  const source = items === MUNICIPALITIES ? MUNICIPALITY_SEARCH_INDEX : items.map((item) => ({
    item,
    normalized: [item.fullName, item.prefecture, item.city].map(normalizeSearchText).join("\n"),
  }));

  const result: Municipality[] = [];
  for (const entry of source) {
    if (entry.normalized.includes(normalizedQuery)) {
      result.push(entry.item);
      if (result.length >= normalizedLimit) {
        break;
      }
    }
  }

  return result;
}
