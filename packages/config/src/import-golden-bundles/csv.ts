/** Minimal CSV helpers for golden bundle CI validation (fixtures use simple unquoted cells). */

export function parseCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim());
}

export function parseCsvTable(content: string): { headers: string[]; rows: string[][] } {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return { headers: [], rows: [] };
  }
  const headers = parseCsvLine(headerLine);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

export function columnIndex(headers: string[], columnName: string): number {
  const index = headers.indexOf(columnName);
  if (index === -1) {
    throw new Error(`Column not found: ${columnName}`);
  }
  return index;
}
