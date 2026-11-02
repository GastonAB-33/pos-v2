import { useState, type FC } from "react";
import {
  FileSpreadsheet,
  Printer,
  FileCode2,
  HelpCircle,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
} from "lucide-react";
import { useLibroIva } from "../../hooks/useLibroIva";
import { LibroIvaKpiCards } from "./LibroIvaKpiCards";
import { LibroIvaConsolidadoTable } from "./LibroIvaConsolidadoTable";
import { LibroIvaVentasTable } from "./LibroIvaVentasTable";
import { LibroIvaComprasTable } from "./LibroIvaComprasTable";
import { LibroIvaPrintSheet } from "./LibroIvaPrintSheet";
import { LibroIvaHelpModal } from "./LibroIvaHelpModal";

interface Props {
  tenantId: string;
}

export const LibroIvaView: FC<Props> = ({ tenantId }) => {
  const {
    availablePeriods,
    selectedPeriod,
    setSelectedPeriod,
    isLoading,
    isExporting,
    error,
    activeSubTab,
    setActiveSubTab,
    ventasSearch,
    setVentasSearch,
    comprasSearch,
    setComprasSearch,
    consolidado,
    ventas,
    totalVentasCount,
    compras,
    totalComprasCount,
    reload,
    exportVentasExcel,
    exportComprasExcel,
    exportConsolidadoExcel,
    exportArcaTxtFiles,
    printOfficialReport,
  } = useLibroIva(tenantId);

  const [showHelp, setShowHelp] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="space-y-4">
      {/* HEADER & PERIOD SELECTOR */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                AFIP / ARCA
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Libro de IVA Digital
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Registros impositivos de Ventas y Compras para auditoría contable y presentación oficial (F. 2083 y F. 2002)
            </p>
          </div>

          {/* CONTROLES DE PERÍODO Y ACCIONES */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Mes */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <label htmlFor="libro-iva-period-select" className="sr-only">Período Fiscal</label>
              <select
                id="libro-iva-period-select"
                value={selectedPeriod.key}
                onChange={(e) => {
                  const target = availablePeriods.find((p) => p.key === e.target.value);
                  if (target) setSelectedPeriod(target);
                }}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none dark:text-slate-100 cursor-pointer"
              >
                {availablePeriods.map((period) => (
                  <option key={period.key} value={period.key} className="dark:bg-slate-900">
                    {period.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Recargar */}
            <button
              type="button"
              onClick={() => void reload()}
              disabled={isLoading}
              title="Actualizar comprobantes"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            </button>

            {/* Botón Imprimir / PDF */}
            <button
              type="button"
              onClick={printOfficialReport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/60"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir F. 2083 (PDF)</span>
            </button>

            {/* Desplegable de Exportaciones */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((prev) => !prev)}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>{isExporting ? "Exportando..." : "Descargar Libros"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {showExportMenu ? (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        void exportConsolidadoExcel();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="font-semibold">Resumen para el Contador (.xlsx)</p>
                        <p className="text-[10px] text-slate-500">Planilla ejecutiva F. 2083</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        void exportVentasExcel();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ArrowUpRight className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-semibold">Libro IVA Ventas (.xlsx)</p>
                        <p className="text-[10px] text-slate-500">Detalle de cada factura emitida</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        void exportComprasExcel();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ArrowDownLeft className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="font-semibold">Libro IVA Compras (.xlsx)</p>
                        <p className="text-[10px] text-slate-500">Facturas de proveedores cargadas</p>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        exportArcaTxtFiles();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                    >
                      <FileCode2 className="h-4 w-4" />
                      <div>
                        <p className="font-semibold">Archivos TXT para ARCA (RG 4597)</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500">
                          Importación directa en Portal IVA
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            {/* Botón de Ayuda */}
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
              <span>¿Cómo funciona?</span>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          ⚠️ {error}
        </div>
      ) : null}

      {/* KPI CARDS */}
      <LibroIvaKpiCards consolidado={consolidado} />

      {/* SUB-TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveSubTab("resumen")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeSubTab === "resumen"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Resumen Oficial F. 2083</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("ventas")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeSubTab === "ventas"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ArrowUpRight className="h-4 w-4 text-blue-500" />
          <span>Libro IVA Ventas</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {totalVentasCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("compras")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
            activeSubTab === "compras"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <ArrowDownLeft className="h-4 w-4 text-purple-500" />
          <span>Libro IVA Compras</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {totalComprasCount}
          </span>
        </button>
      </div>

      {/* SUB-TAB CONTENTS */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span>Calculando libro contable e impuestos del período...</span>
          </div>
        </div>
      ) : (
        <>
          {activeSubTab === "resumen" && (
            <LibroIvaConsolidadoTable consolidado={consolidado} />
          )}

          {activeSubTab === "ventas" && (
            <LibroIvaVentasTable
              ventas={ventas}
              totalCount={totalVentasCount}
              search={ventasSearch}
              onSearchChange={setVentasSearch}
            />
          )}

          {activeSubTab === "compras" && (
            <LibroIvaComprasTable
              compras={compras}
              totalCount={totalComprasCount}
              search={comprasSearch}
              onSearchChange={setComprasSearch}
            />
          )}
        </>
      )}

      {/* PRINTABLE COMPONENT (Hidden from screen, renders when print is invoked) */}
      <LibroIvaPrintSheet
        consolidado={consolidado}
        ventas={ventas}
        compras={compras}
      />

      {/* MODAL DE AYUDA FÁCIL */}
      <LibroIvaHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};
