import type { FC } from "react";
import type { LibroIvaConsolidado, LibroIvaVentaItem, LibroIvaCompraItem } from "../../types/libro-iva.types";
import { formatCurrency } from "../../utils/libro-iva.utils";

interface Props {
  consolidado: LibroIvaConsolidado;
  ventas: LibroIvaVentaItem[];
  compras: LibroIvaCompraItem[];
}

export const LibroIvaPrintSheet: FC<Props> = ({ consolidado, ventas, compras }) => {
  const { period, cuitEmisor, razonSocial, ventas: cv, compras: cc, posicion } = consolidado;
  const printDate = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="hidden print:block fixed inset-0 z-[99999] bg-white p-8 text-black font-sans leading-tight">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #libro-iva-print-root, #libro-iva-print-root * {
            visibility: visible;
          }
          #libro-iva-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      <div id="libro-iva-print-root" className="space-y-6">
        {/* ENCABEZADO MEMBRETADO */}
        <div className="border-b-2 border-black pb-3">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold tracking-tight">ARCA - LIBRO DE IVA DIGITAL</h1>
              <p className="text-sm font-semibold">FORMULARIO F. 2083 - VERSIÓN 300</p>
              <p className="text-xs text-gray-700">RÉGIMEN DE REGISTRACIÓN ELECTRÓNICA RG 4597/2019</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-sm">{razonSocial}</p>
              <p className="font-mono">CUIT: {cuitEmisor}</p>
              <p>Período: <span className="font-bold">{period.label} ({period.periodCode})</span></p>
              <p className="text-gray-500">Fecha de emisión: {printDate}</p>
            </div>
          </div>
        </div>

        {/* 1. VENTAS CONSOLIDADO */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider bg-gray-200 px-2 py-1 mb-1">
            LIBRO DE IVA DIGITAL - VENTAS
          </h2>
          <table className="w-full text-xs border border-collapse border-gray-400">
            <thead>
              <tr className="bg-gray-100 font-semibold border-b border-gray-400">
                <th className="p-1.5 text-left border-r border-gray-400">Concepto</th>
                <th className="p-1.5 text-right border-r border-gray-400">Neto Gravado</th>
                <th className="p-1.5 text-right border-r border-gray-400">Exento o No Gravado</th>
                <th className="p-1.5 text-right">Débito Fiscal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-gray-400">Operaciones de Venta</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cv.operacionesVentaNeto)}</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cv.operacionesVentaExento)}</td>
                <td className="p-1.5 text-right font-mono font-bold">{formatCurrency(cv.operacionesVentaDebito)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-gray-400">Notas de Crédito de Venta</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">-{formatCurrency(cv.notasCreditoNeto)}</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cv.notasCreditoExento)}</td>
                <td className="p-1.5 text-right font-mono">-{formatCurrency(cv.notasCreditoDebito)}</td>
              </tr>
              <tr className="font-bold bg-gray-50">
                <td className="p-1.5 border-r border-gray-400">Total Débito Facturado</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cv.totalNetoGravado)}</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cv.operacionesVentaExento)}</td>
                <td className="p-1.5 text-right font-mono">{formatCurrency(cv.totalDebitoFiscal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 2. COMPRAS CONSOLIDADO */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider bg-gray-200 px-2 py-1 mb-1">
            LIBRO DE IVA DIGITAL - COMPRAS
          </h2>
          <table className="w-full text-xs border border-collapse border-gray-400">
            <thead>
              <tr className="bg-gray-100 font-semibold border-b border-gray-400">
                <th className="p-1.5 text-left border-r border-gray-400">Concepto</th>
                <th className="p-1.5 text-right border-r border-gray-400">Neto Gravado</th>
                <th className="p-1.5 text-right border-r border-gray-400">Exento o No Gravado</th>
                <th className="p-1.5 text-right">Crédito Fiscal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-gray-400">Operaciones de Compra</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.operacionesCompraNeto)}</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.operacionesCompraExento)}</td>
                <td className="p-1.5 text-right font-mono font-bold">{formatCurrency(cc.operacionesCompraCredito)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-gray-400">Notas de Crédito de Compra (Crédito a Restituir)</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.notasCreditoNeto)}</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.notasCreditoExento)}</td>
                <td className="p-1.5 text-right font-mono">{formatCurrency(cc.notasCreditoCreditoRestituir)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="p-1.5 border-r border-gray-400">Operaciones que no generan Crédito Fiscal (Facturas C)</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">-</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.operacionesNoGeneranCredito)}</td>
                <td className="p-1.5 text-right font-mono">$ 0,00</td>
              </tr>
              <tr className="font-bold bg-gray-50">
                <td className="p-1.5 border-r border-gray-400">Total Crédito Fiscal Computable</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.operacionesCompraNeto)}</td>
                <td className="p-1.5 text-right font-mono border-r border-gray-400">{formatCurrency(cc.operacionesCompraExento + cc.operacionesNoGeneranCredito)}</td>
                <td className="p-1.5 text-right font-mono">{formatCurrency(cc.totalCreditoFiscal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. ALÍCUOTAS DETALLADAS */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase mb-1">Ventas por Alícuota</h3>
            <table className="w-full text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="p-1 text-left">Alícuota</th>
                  <th className="p-1 text-right">Neto Gravado</th>
                  <th className="p-1 text-right">Débito Fiscal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1 font-semibold">21%</td>
                  <td className="p-1 text-right font-mono">{formatCurrency(cv.netoGravado21)}</td>
                  <td className="p-1 text-right font-mono">{formatCurrency(cv.debitoFiscal21)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase mb-1">Compras por Alícuota</h3>
            <table className="w-full text-xs border border-collapse border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="p-1 text-left">Alícuota</th>
                  <th className="p-1 text-right">Neto Gravado</th>
                  <th className="p-1 text-right">Crédito Fiscal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1 font-semibold">21%</td>
                  <td className="p-1 text-right font-mono">{formatCurrency(cc.netoGravado21)}</td>
                  <td className="p-1 text-right font-mono">{formatCurrency(cc.creditoFiscal21)}</td>
                </tr>
                {cc.netoGravado105 > 0 ? (
                  <tr>
                    <td className="p-1 font-semibold">10,5%</td>
                    <td className="p-1 text-right font-mono">{formatCurrency(cc.netoGravado105)}</td>
                    <td className="p-1 text-right font-mono">{formatCurrency(cc.creditoFiscal105)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. LIQUIDACIÓN F. 2002 */}
        <div className="border border-black p-3 bg-gray-50">
          <h3 className="text-xs font-bold uppercase tracking-wider mb-2">
            DATOS PARA LA DECLARACIÓN JURADA DEL IMPUESTO AL VALOR AGREGADO (F. 2002)
          </h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-gray-600">Total del Débito Fiscal:</p>
              <p className="text-base font-bold font-mono">{formatCurrency(posicion.totalDebitoFiscal)}</p>
            </div>
            <div>
              <p className="text-gray-600">Total del Crédito Fiscal:</p>
              <p className="text-base font-bold font-mono">{formatCurrency(posicion.totalCreditoFiscal)}</p>
            </div>
            <div>
              <p className="text-gray-600">{posicion.esSaldoAFavor ? "Saldo a Favor del Período:" : "Saldo Técnico a Ingresar:"}</p>
              <p className="text-base font-bold font-mono">{formatCurrency(posicion.saldoIva)}</p>
            </div>
          </div>
        </div>

        {/* PIE DE FIRMA Y AUDITORÍA */}
        <div className="pt-6 border-t border-gray-300 text-[10px] text-gray-500 flex justify-between items-center">
          <p>Comprobantes auditados en sistema: Ventas ({ventas.length}) | Compras ({compras.length})</p>
          <p>Generado automáticamente por POS V2 • Sistema de Gestión y Facturación Fiscal ARCA</p>
        </div>
      </div>
    </div>
  );
};
