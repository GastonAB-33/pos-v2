export type XlsxCellValue = string | number | boolean | null | undefined;
export type XlsxRow = Record<string, XlsxCellValue>;

const sanitizeSheetName = (value: string): string => {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, "").trim();
  return cleaned || "Hoja1";
};

const assertBrowserContext = (): boolean =>
  typeof window !== "undefined" && typeof document !== "undefined";

const loadXlsxModule = async (): Promise<typeof import("xlsx")> => {
  const mod = await import("xlsx");
  return ((mod as any).default?.utils ? (mod as any).default : mod) as typeof import("xlsx");
};

export const downloadXlsx = async (
  fileName: string,
  sheetName: string,
  rows: XlsxRow[]
): Promise<boolean> => {
  if (!rows.length || !assertBrowserContext()) {
    return false;
  }

  try {
    const XLSX = await loadXlsxModule();

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));

    const safeFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;

    // 1. Intentar con writeFile nativo de SheetJS para browser
    if (typeof (XLSX as any).writeFile === "function") {
      try {
        (XLSX as any).writeFile(workbook, safeFileName);
        return true;
      } catch (writeErr) {
        console.warn("XLSX.writeFile no completó, usando fallback de Blob:", writeErr);
      }
    }

    // 2. Fallback con Blob y anchor click (sin revocar síncronamente)
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
    anchor.download = safeFileName;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      URL.revokeObjectURL(objectUrl);
    }, 2000);

    return true;
  } catch (error) {
    console.error("Error al generar o descargar el archivo XLSX:", error);
    return false;
  }
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

  return (XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: "",
  }) as unknown) as XlsxRow[];
};
