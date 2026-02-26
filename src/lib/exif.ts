export type ParsedExif = {
  takenAt?: Date;
  lat?: number;
  lng?: number;
  hasGps: boolean;
  make?: string;
  model?: string;
  fNumber?: number;
  exposureTime?: string;
  iso?: number;
  focalLength?: number;
};

const EXIF_MARKER = 0xffe1;
const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_GPS_IFD_POINTER = 0x8825;
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME = 0x0132;
const TAG_FNUMBER = 0x829d;
const TAG_EXPOSURE_TIME = 0x829a;
const TAG_ISO = 0x8827;
const TAG_FOCAL_LENGTH = 0x920a;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/^\s+|\s+$/g, "").replace(/:/g, "-").replace(" ", "T");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function asExposure([num, den]: [number, number]): string {
  if (!den) return `${num}`;
  if (num < den) return `1/${Math.round(den / Math.max(num, 1))}`;
  return `${(num / den).toFixed(4).replace(/\.0+$/, "")}`;
}

function gpsToDecimal(values: number[], ref?: string): number | undefined {
  if (values.length < 3) return undefined;
  const [deg, min, sec] = values;
  let result = deg + min / 60 + sec / 3600;
  if (ref === "S" || ref === "W") result *= -1;
  return result;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const ch = view.getUint8(offset + i);
    if (ch === 0) break;
    out += String.fromCharCode(ch);
  }
  return out.trim();
}

function readValue(view: DataView, tiffStart: number, type: number, count: number, valueOffsetPos: number, little: boolean): unknown {
  const unit = type === 1 || type === 2 || type === 7 ? 1 : type === 3 ? 2 : type === 4 || type === 9 ? 4 : 8;
  const byteLen = unit * count;
  const dataOffset = byteLen <= 4
    ? valueOffsetPos
    : tiffStart + view.getUint32(valueOffsetPos, little);

  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  switch (type) {
    case 2:
      return readAscii(view, dataOffset, count);
    case 3:
      return count === 1 ? u16(dataOffset) : Array.from({ length: count }, (_, i) => u16(dataOffset + i * 2));
    case 4:
      return count === 1 ? u32(dataOffset) : Array.from({ length: count }, (_, i) => u32(dataOffset + i * 4));
    case 5:
      if (count === 1) return [u32(dataOffset), u32(dataOffset + 4)] as [number, number];
      return Array.from({ length: count }, (_, i) => {
        const base = dataOffset + i * 8;
        const n = u32(base);
        const d = u32(base + 4);
        return d ? n / d : 0;
      });
    default:
      return undefined;
  }
}

function readIfd(view: DataView, tiffStart: number, ifdOffset: number, little: boolean): Map<number, unknown> {
  const map = new Map<number, unknown>();
  const entries = view.getUint16(tiffStart + ifdOffset, little);
  for (let i = 0; i < entries; i += 1) {
    const base = tiffStart + ifdOffset + 2 + i * 12;
    const tag = view.getUint16(base, little);
    const type = view.getUint16(base + 2, little);
    const count = view.getUint32(base + 4, little);
    const value = readValue(view, tiffStart, type, count, base + 8, little);
    map.set(tag, value);
  }
  return map;
}

export async function parseExifFromFile(file: File): Promise<ParsedExif> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xffd8) return { hasGps: false };

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === EXIF_MARKER && readAscii(view, offset + 4, 6) === "Exif") {
      const tiffStart = offset + 10;
      const little = view.getUint16(tiffStart) === 0x4949;
      const ifd0Offset = view.getUint32(tiffStart + 4, little);
      const ifd0 = readIfd(view, tiffStart, ifd0Offset, little);

      const exifIfdOffset = Number(ifd0.get(TAG_EXIF_IFD_POINTER) ?? 0);
      const gpsIfdOffset = Number(ifd0.get(TAG_GPS_IFD_POINTER) ?? 0);

      const exifIfd = exifIfdOffset ? readIfd(view, tiffStart, exifIfdOffset, little) : new Map<number, unknown>();
      const gpsIfd = gpsIfdOffset ? readIfd(view, tiffStart, gpsIfdOffset, little) : new Map<number, unknown>();

      const lat = gpsToDecimal((gpsIfd.get(TAG_GPS_LAT) as number[]) ?? [], gpsIfd.get(TAG_GPS_LAT_REF) as string | undefined);
      const lng = gpsToDecimal((gpsIfd.get(TAG_GPS_LNG) as number[]) ?? [], gpsIfd.get(TAG_GPS_LNG_REF) as string | undefined);
      const exposure = exifIfd.get(TAG_EXPOSURE_TIME) as [number, number] | undefined;
      const dateRaw = (exifIfd.get(TAG_DATETIME_ORIGINAL) as string | undefined) || (ifd0.get(TAG_DATETIME) as string | undefined);

      return {
        takenAt: toDate(dateRaw),
        lat,
        lng,
        hasGps: typeof lat === "number" && typeof lng === "number",
        make: (ifd0.get(TAG_MAKE) as string | undefined) || undefined,
        model: (ifd0.get(TAG_MODEL) as string | undefined) || undefined,
        fNumber: (() => {
          const f = exifIfd.get(TAG_FNUMBER);
          if (Array.isArray(f)) return Number((f as [number, number])[0] / Math.max((f as [number, number])[1], 1));
          return typeof f === "number" ? f : undefined;
        })(),
        exposureTime: exposure ? asExposure(exposure) : undefined,
        iso: Number(exifIfd.get(TAG_ISO) ?? 0) || undefined,
        focalLength: (() => {
          const fl = exifIfd.get(TAG_FOCAL_LENGTH);
          if (Array.isArray(fl)) return Number((fl as [number, number])[0] / Math.max((fl as [number, number])[1], 1));
          return typeof fl === "number" ? fl : undefined;
        })(),
      };
    }

    offset += 2 + size;
  }

  return { hasGps: false };
}
