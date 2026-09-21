export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];

  for (const row of rows) {
    const line = headers.map((h) => escapeCsvValue(row[h])).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}