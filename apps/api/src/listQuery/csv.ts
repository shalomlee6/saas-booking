/** Hard cap so one export cannot stream an unbounded result set. */
export const CSV_EXPORT_ROW_CAP = 10_000;

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export interface CsvColumn {
  key: string;
  header: string;
  /** Prefix so spreadsheet apps keep the value as text (leading zeros). */
  phone?: boolean;
}

export interface CsvExportResult {
  body: string;
  rowCount: number;
  truncated: boolean;
}

function cellText(value: unknown, phone: boolean | undefined): string {
  if (value == null) return '';
  let text = String(value);
  if (phone && text !== '') {
    text = `'${text}`;
  } else if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * UTF-8 CSV with a leading BOM. Formula-like cells are prefixed with an
 * apostrophe. Phone columns are always text. Rows beyond `maxRows` are omitted
 * and `truncated` is set.
 */
export function buildCsv(
  columns: readonly CsvColumn[],
  rows: readonly Record<string, unknown>[],
  maxRows: number = CSV_EXPORT_ROW_CAP
): CsvExportResult {
  const cap = Math.max(0, maxRows);
  const sliced = rows.slice(0, cap);
  const header = columns.map((column) => cellText(column.header, false)).join(',');
  const lines = sliced.map((row) =>
    columns.map((column) => cellText(row[column.key], column.phone)).join(',')
  );
  return {
    body: `\uFEFF${[header, ...lines].join('\r\n')}`,
    rowCount: sliced.length,
    truncated: rows.length > sliced.length,
  };
}
