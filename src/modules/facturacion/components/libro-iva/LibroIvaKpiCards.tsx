import type { FC } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale, Receipt } from "lucide-react";
import type { LibroIvaConsolidado } from "../../types/libro-iva.types";
import { formatCurrency } from "../../utils/libro-iva.utils";

interface Props {
  consolidado: LibroIvaConsolidado;
}

export const LibroIvaKpiCards: FC<Props> = ({ consolidado }) => {
  const { ventas, compras, posicion } = consolidado;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. DÉBITO FISCAL (VENTAS) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Débito Fiscal (IVA Ventas)
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {formatCurrency(ventas.totalDebitoFiscal)}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{ventas.cantidadComprobantes} facturas / comprobantes</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Neto: {formatCurrency(ventas.totalNetoGravado)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
          IVA cobrado a clientes a ingresar a ARCA
        </p>
      </div>

      {/* 2. CRÉDITO FISCAL (COMPRAS) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Crédito Fiscal (IVA Compras)
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <ArrowDownLeft className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {formatCurrency(compras.totalCreditoFiscal)}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{compras.cantidadComprobantes} facturas proveedor</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Neto: {formatCurrency(compras.totalNetoGravado)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-purple-600 dark:text-purple-400">
          IVA pagado que se descuenta a tu favor
        </p>
      </div>

      {/* 3. POSICIÓN TÉCNICA ESTIMADA (F. 2002) */}
      <div
        className={`rounded-xl border p-4 shadow-sm transition ${
          posicion.esSaldoAFavor
            ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            : "border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Saldo Técnico Estimado
          </span>
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
              posicion.esSaldoAFavor
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
            }`}
          >
            <Scale className="h-4 w-4" />
          </span>
        </div>
        <p
          className={`mt-2 text-2xl font-bold tracking-tight ${
            posicion.esSaldoAFavor
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-800 dark:text-amber-300"
          }`}
        >
          {formatCurrency(posicion.saldoIva)}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              posicion.esSaldoAFavor
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200"
            }`}
          >
            {posicion.esSaldoAFavor ? "Saldo a Favor" : "A Pagar Estimado"}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Formulario 2002</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {posicion.esSaldoAFavor
            ? "El crédito de compras superó al débito de ventas"
            : "Diferencia de IVA a ingresar por el período"}
        </p>
      </div>

      {/* 4. COMPRAS NO COMPUTABLES (MONOTRIBUTO / FACTURA C) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Compras Monotributo (No Computable)
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Receipt className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {formatCurrency(compras.operacionesNoGeneranCredito)}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Facturas C / Exentos</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">No descuenta IVA</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Gastos reales que justifican egresos del negocio
        </p>
      </div>
    </div>
  );
};
