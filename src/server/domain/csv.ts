/**
 * CSV rendering for named exports (Story 7.5). Pure and defensive:
 * RFC-4180 quoting (commas, quotes, newlines), CRLF line endings, and a
 * spreadsheet formula-injection guard — a cell starting with =, +, -, or
 * @ is prefixed with a single quote so Excel/Sheets treat it as text,
 * never as a formula (the export may be opened by a funder on any
 * machine; OWASP CSV-injection guidance).
 */

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (text.length > 0 && FORMULA_TRIGGERS.includes(text[0])) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Render a header row plus data rows. Every row must match the header
 * width — a mismatch is a programming error in the export definition
 * and throws rather than silently misaligning columns.
 */
export function toCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null>>,
): string {
  for (const row of rows) {
    if (row.length !== headers.length) {
      throw new Error(
        `CSV row width ${row.length} does not match header width ${headers.length}`,
      );
    }
  }
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}
