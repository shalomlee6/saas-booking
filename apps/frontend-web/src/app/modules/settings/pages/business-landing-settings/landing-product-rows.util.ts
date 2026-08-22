export type LandingProductRowValue = {
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
};

export type LandingProductPayloadItem = {
  name: string;
  description: string;
  price: number;
};

function numPrice(value: unknown): number {
  if (value === '' || value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** A freshly added row the owner has not started filling in. */
export function isBlankProductRow(row: LandingProductRowValue): boolean {
  const name = String(row.name ?? '').trim();
  const description = String(row.description ?? '').trim();
  const price = numPrice(row.price);
  return !name && !description && (price === 0 || Number.isNaN(price));
}

/**
 * Human-readable issue for a row that would produce broken product data.
 * Fully blank rows return null — they are ignored on save, not blockers.
 */
export function productRowIssue(row: LandingProductRowValue, index: number): string | null {
  if (isBlankProductRow(row)) return null;
  const line = index + 1;
  const name = String(row.name ?? '').trim();
  if (!name) {
    return `בשורה ${line} חסר שם למוצר — מלאי אותו או הסירי את השורה`;
  }
  if (name.length > 200) {
    return `בשורה ${line} שם המוצר ארוך מדי`;
  }
  const price = numPrice(row.price);
  if (Number.isNaN(price) || price < 0) {
    return `בשורה ${line} המחיר לא תקין`;
  }
  return null;
}

export function collectProductRowIssues(rows: LandingProductRowValue[]): string[] {
  return rows
    .map((row, index) => productRowIssue(row, index))
    .filter((msg): msg is string => msg != null);
}

/** Payload for PUT landingProducts: skips blank unused rows. */
export function toLandingProductsPayload(
  rows: LandingProductRowValue[]
): LandingProductPayloadItem[] {
  return rows
    .filter((row) => !isBlankProductRow(row))
    .map((row) => ({
      name: String(row.name ?? '').trim(),
      description: String(row.description ?? '').trim(),
      price: numPrice(row.price),
    }));
}
