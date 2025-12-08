export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export function normalizeContactIds(raw: any): { dbIds: number[]; contactIds: (string | number)[] } {
  if (!Array.isArray(raw)) return { dbIds: [], contactIds: [] };

  const dbIds: number[] = [];
  const contactIds: (string | number)[] = [];

  for (const value of raw) {
    const candidate =
      value && typeof value === "object"
        ? ("id" in value ? (value as any).id : "contact_id" in value ? (value as any).contact_id : value)
        : value;

    if (candidate === null || candidate === undefined || candidate === "") continue;

    const asNumber = Number(candidate);
    if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
      dbIds.push(asNumber);
    }
    contactIds.push(candidate);
  }

  return {
    dbIds: Array.from(new Set(dbIds)),
    contactIds: Array.from(new Set(contactIds))
  };
}

export function coerceContactIds(raw: any): (string | number)[] {
  if (Array.isArray(raw)) return raw as (string | number)[];

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as (string | number)[];
    } catch {
      // ignore parse errors
    }
  }

  if (raw && typeof raw === "object") {
    try {
      return Object.values(raw) as (string | number)[];
    } catch {
      return [];
    }
  }

  return [];
}
