export type MunicipalityInfo = {
  prefectureName: string;
  municipalityName: string;
  municipalityCode: string | null;
  municipalityKey: string;
};

function normalizeName(value: string): string {
  return value.replace(/\s+/g, "").replace(/[\u3000]/g, "").trim();
}

export function buildMunicipalityKey(prefecture: string, municipality: string): string {
  return `${normalizeName(prefecture).toLowerCase()}::${normalizeName(municipality).toLowerCase()}`;
}

export async function reverseGeocodeMunicipality(lat: number, lng: number): Promise<MunicipalityInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      "Accept-Language": "ja",
    },
  });

  if (!res.ok) {
    throw new Error(`reverse geocode failed: ${res.status}`);
  }

  const json = await res.json();
  const address = (json?.address ?? {}) as Record<string, string | undefined>;

  const prefectureName =
    address.state ??
    address.province ??
    address.region ??
    "不明";

  const municipalityName =
    address.city ??
    address.town ??
    address.village ??
    address.city_district ??
    address.county ??
    "不明";

  const municipalityCode = address.city_code ?? address.municipality_code ?? null;

  return {
    prefectureName,
    municipalityName,
    municipalityCode,
    municipalityKey: buildMunicipalityKey(prefectureName, municipalityName),
  };
}
