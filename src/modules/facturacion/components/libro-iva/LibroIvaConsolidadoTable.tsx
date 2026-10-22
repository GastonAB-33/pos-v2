import type { FC } from "react";
import type { LibroIvaConsolidado } from "../../types/libro-iva.types";
import { formatCurrency } from "../../utils/libro-iva.utils";

interface Props {
  consolidado: LibroIvaConsolidado;
}

export const LibroIvaConsolidadoTable: FC<Props> = ({ consolidado }) => {
  const { period, cuitEmisor, razonSocial, ventas, compras, posicion } = consolidado;

  return (
    <div className="space-y-6">
      {/* HEADER DE PRESENTACIÓN OFICIAL */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              ARCA • Formulario F. 2083
            </span>
            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
              Vista Previa y Acuse Consolidado de IVA
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Período Fiscal: <span className="font-semibold text-slate-700 dark:text-slate-300">{period.label}</span> ({period.periodCode})
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="text-slate-500 dark:text-slate-400">Contribuyente:</p>
            <p className="font-bold text-slate-900 dark:text-slate-100">{razonSocial}</p>
            <p className="font-mono text-slate-600 dark:text-slate-300">CUIT: {cuitEmisor}</p>
          </div>
        </div>

        {/* 1. SECCIÓN VENTAS */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              1. Libro IVA Ventas
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {ventas.cantidadComprobantes} comprobantes registrados
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Concepto</th>
                  <th className="px-3 py-2.5 text-right">Neto Gravado</th>
                  <th className="px-3 py-2.5 text-right">Exento o No Gravado</th>
                  <th className="px-3 py-2.5 text-right text-blue-700 dark:text-blue-300">Débito Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <td className="px-3 py-2 font-medium">Operaciones de Ventas</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(ventas.operacionesVentaNeto)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(ventas.operacionesVentaExento)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700 dark:text-blue-300">
                    {formatCurrency(ventas.operacionesVentaDebito)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-rose-700 dark:text-rose-400">
                    Notas de Crédito de Ventas
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-rose-700 dark:text-rose-400">
                    -{formatCurrency(ventas.notasCreditoNeto)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(ventas.notasCreditoExento)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-rose-700 dark:text-rose-400">
                    -{formatCurrency(ventas.notasCreditoDebito)}
                  </td>
                </tr>
                <tr className="bg-slate-50/70 font-bold dark:bg-slate-800/40 text-slate-900 dark:text-slate-100">
                  <td className="px-3 py-2.5">Total Neto Facturado y Débito Líquido</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(ventas.totalNetoGravado)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(ventas.operacionesVentaExento)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-blue-800 dark:text-blue-200">
                    {formatCurrency(ventas.totalDebitoFiscal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. SECCIÓN COMPRAS */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              2. Libro IVA Compras
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {compras.cantidadComprobantes} compras a proveedores
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Concepto</th>
                  <th className="px-3 py-2.5 text-right">Neto Gravado</th>
                  <th className="px-3 py-2.5 text-right">Exento o No Gravado</th>
                  <th className="px-3 py-2.5 text-right text-purple-700 dark:text-purple-300">Crédito Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <td className="px-3 py-2 font-medium">Operaciones de Compra (Bienes y Servicios)</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(compras.operacionesCompraNeto)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(compras.operacionesCompraExento)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-purple-700 dark:text-purple-300">
                    {formatCurrency(compras.operacionesCompraCredito)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-amber-700 dark:text-amber-400">
                    Notas de Crédito de Proveedores (Crédito a Restituir)
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700 dark:text-amber-400">
                    {formatCurrency(compras.notasCreditoNeto)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(compras.notasCreditoExento)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-amber-700 dark:text-amber-400">
                    {formatCurrency(compras.notasCreditoCreditoRestituir)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    Operaciones que no generan Crédito Fiscal (Facturas C Monotributo)
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">-</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {formatCurrency(compras.operacionesNoGeneranCredito)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">$ 0,00</td>
                </tr>
                <tr className="bg-slate-50/70 font-bold dark:bg-slate-800/40 text-slate-900 dark:text-slate-100">
                  <td className="px-3 py-2.5">Total Crédito Fiscal Computable del Mes</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(compras.operacionesCompraNeto)}</td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatCurrency(compras.operacionesCompraExento + compras.operacionesNoGeneranCredito)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-purple-800 dark:text-purple-200">
                    {formatCurrency(compras.totalCreditoFiscal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. INFORMACIÓN CONSOLIDADA POR ALÍCUOTA */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Alícuotas Ventas */}
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Ventas Consolidadas por Alícuota
            </h5>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="py-1">Alícuota</th>
                  <th className="py-1 text-right">Neto Gravado</th>
                  <th className="py-1 text-right">Débito Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                <tr>
                  <td className="py-1.5 font-sans font-medium">21,00 %</td>
                  <td className="py-1.5 text-right">{formatCurrency(ventas.netoGravado21)}</td>
                  <td className="py-1.5 text-right text-blue-600 dark:text-blue-400">
                    {formatCurrency(ventas.debitoFiscal21)}
                  </td>
                </tr>
                {ventas.netoGravado105 > 0 ? (
                  <tr>
                    <td className="py-1.5 font-sans font-medium">10,50 %</td>
                    <td className="py-1.5 text-right">{formatCurrency(ventas.netoGravado105)}</td>
                    <td className="py-1.5 text-right text-blue-600 dark:text-blue-400">
                      {formatCurrency(ventas.debitoFiscal105)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Alícuotas Compras */}
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Compras Consolidadas por Alícuota
            </h5>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="py-1">Alícuota</th>
                  <th className="py-1 text-right">Neto Gravado</th>
                  <th className="py-1 text-right">Crédito Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                <tr>
                  <td className="py-1.5 font-sans font-medium">21,00 %</td>
                  <td className="py-1.5 text-right">{formatCurrency(compras.netoGravado21)}</td>
                  <td className="py-1.5 text-right text-purple-600 dark:text-purple-400">
                    {formatCurrency(compras.creditoFiscal21)}
                  </td>
                </tr>
                {compras.netoGravado105 > 0 ? (
                  <tr>
                    <td className="py-1.5 font-sans font-medium">10,50 %</td>
                    <td className="py-1.5 text-right">{formatCurrency(compras.netoGravado105)}</td>
                    <td className="py-1.5 text-right text-purple-600 dark:text-purple-400">
                      {formatCurrency(compras.creditoFiscal105)}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. DATOS PARA LA DECLARACIÓN JURADA F. 2002 */}
        <div className="mt-6 rounded-xl border border-slate-300 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Datos para la Declaración Jurada F. 2002 (ARCA)
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">Liquidación Técnica</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-slate-900">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Total Débito Fiscal
              </span>
              <p className="mt-1 font-mono text-base font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(posicion.totalDebitoFiscal)}
              </p>
              <p className="text-[10px] text-slate-400">Ventas + Restituciones NC</p>
            </div>

            <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-slate-900">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Total Crédito Fiscal
              </span>
              <p className="mt-1 font-mono text-base font-bold text-purple-700 dark:text-purple-300">
                {formatCurrency(posicion.totalCreditoFiscal)}
              </p>
              <p className="text-[10px] text-slate-400">Compras Computables</p>
            </div>

            <div
              className={`rounded-lg p-3 shadow-xs ${
                posicion.esSaldoAFavor
                  ? "bg-emerald-50 dark:bg-emerald-950/40"
                  : "bg-amber-50 dark:bg-amber-950/40"
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {posicion.esSaldoAFavor ? "Saldo a Favor del Mes" : "Saldo Técnico a Ingresar"}
              </span>
              <p
                className={`mt-1 font-mono text-base font-bold ${
                  posicion.esSaldoAFavor
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-800 dark:text-amber-300"
                }`}
              >
                {formatCurrency(posicion.saldoIva)}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {posicion.esSaldoAFavor ? "A computar el próximo mes" : "Estimación técnica sin retenciones"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
