export type XlsxCellValue = string | number | boolean | null | undefined;
export type XlsxRow = Record<string, XlsxCellValue>;

const sanitizeSheetName = (value: string): string => {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, "").trim();
  return cleaned || "Hoja1";
};

const assertBrowserContext = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

const loadXlsxModule = async () => import("xlsx");

export const downloadXlsx = async (
  fileName: string,
  sheetName: string,
  rows: XlsxRow[]
): Promise<boolean> => {
  if (!rows.length || !assertBrowserContext()) {
    return false;
  }

  const XLSX = await loadXlsxModule();

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));

  const workbookArray = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([workbookArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);

  return true;
};

export const parseXlsxFile = async (file: File): Promise<XlsxRow[]> => {
  const XLSX = await loadXlsxModule();
  const fileBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(fileBuffer, {
    type: "array",
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];

  return XLSX.utils.sheet_to_json<XlsxRow>(worksheet, {
    raw: false,
    defval: "",
  });
};
