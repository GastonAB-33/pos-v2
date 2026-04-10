export type CsvCellValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCellValue>;

const escapeCell = (value: CsvCellValue): string => {
  const raw = value == null ? "" : String(value);

  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
};

export const buildCsvContent = (rows: CsvRow[]): string => {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map((header) => escapeCell(header)).join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ];

  return lines.join("\n");
};

export const downloadCsv = (fileName: string, rows: CsvRow[]): boolean => {
  if (!rows.length || typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const csvContent = buildCsvContent(rows);
  const csvBlob = new Blob(["\uFEFF", csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const objectUrl = URL.createObjectURL(csvBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(objectUrl);

  return true;
};
