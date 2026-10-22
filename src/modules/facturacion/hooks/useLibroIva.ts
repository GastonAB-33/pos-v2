import { useCallback, useEffect, useMemo, useState } from "react";
import { invoicesService } from "@/services/invoices.service";
import { creditNotesService } from "@/services/credit-notes.service";
import { purchasesService } from "@/services/purchases.service";
import { suppliersService } from "@/services/suppliers.service";
import { settingsService } from "@/services/settings.service";
import type { Invoice, CreditNote, Purchase, Supplier, BusinessSettings, FacturacionSettings } from "@/types/entities";
import { downloadCsv } from "@/utils/csv";
import { downloadXlsx } from "@/utils/xlsx";
import type { LibroIvaPeriod } from "../types/libro-iva.types";
import {
  generateAvailablePeriods,
  calculateLibroIvaData,
  buildVentasExportRows,
  buildComprasExportRows,
  buildConsolidadoExportRows,
  generateArcaVentasCbteTxt,
  generateArcaVentasAlicuotasTxt,
  generateArcaComprasCbteTxt,
  generateArcaComprasAlicuotasTxt,
  downloadPlainTxt,
} from "../utils/libro-iva.utils";

export type LibroIvaSubTab = "resumen" | "ventas" | "compras" | "guia";

export const useLibroIva = (tenantId: string | null) => {
  const availablePeriods = useMemo(() => generateAvailablePeriods(12), []);
  const [selectedPeriod, setSelectedPeriod] = useState<LibroIvaPeriod>(() => availablePeriods[0]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [facturacionSettings, setFacturacionSettings] = useState<FacturacionSettings | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<LibroIvaSubTab>("resumen");
  const [ventasSearch, setVentasSearch] = useState("");
  const [comprasSearch, setComprasSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setInvoices([]);
      setCreditNotes([]);
      setPurchases([]);
      setSuppliers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [invRows, ncRows, purRows, supRows, tenantSettings] = await Promise.all([
        invoicesService.getAllByTenant(tenantId),
        creditNotesService.getAllByTenant(tenantId),
        purchasesService.getAllByTenant(tenantId),
        suppliersService.getAllByTenant(tenantId),
        settingsService.getByTenant(tenantId),
      ]);

      setInvoices(invRows);
      setCreditNotes(ncRows);
      setPurchases(purRows);
      setSuppliers(supRows);
      setBusinessSettings(tenantSettings.negocio ?? null);
      setFacturacionSettings(tenantSettings.facturacion ?? null);
    } catch (err) {
      console.error("Error al cargar datos de Libro IVA:", err);
      setError("No se pudieron cargar los comprobantes contables para el Libro IVA.");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Cálculo memoizado de todos los totales y listas del período seleccionado
  const computedData = useMemo(() => {
    return calculateLibroIvaData({
      period: selectedPeriod,
      invoices,
      creditNotes,
      purchases,
      suppliers,
      businessSettings,
      facturacionSettings,
    });
  }, [selectedPeriod, invoices, creditNotes, purchases, suppliers, businessSettings, facturacionSettings]);

  const { consolidado, ventas, compras } = computedData;

  // Filtrado de ventas para la tabla
  const filteredVentas = useMemo(() => {
    const q = ventasSearch.trim().toLowerCase();
    if (!q) return ventas;
    return ventas.filter(
      (v) =>
        v.customerName.toLowerCase().includes(q) ||
        v.customerDocNumber.includes(q) ||
        v.formattedVoucher.includes(q) ||
        (v.cae && v.cae.includes(q))
    );
  }, [ventas, ventasSearch]);

  // Filtrado de compras para la tabla
  const filteredCompras = useMemo(() => {
    const q = comprasSearch.trim().toLowerCase();
    if (!q) return compras;
    return compras.filter(
      (c) =>
        c.supplierName.toLowerCase().includes(q) ||
        c.supplierCuit.includes(q) ||
        c.documentNumber.toLowerCase().includes(q)
    );
  }, [compras, comprasSearch]);

  // ==========================================
  // EXPORTACIONES A EXCEL / CSV / ARCA
  // ==========================================

  const exportVentasExcel = async () => {
    setIsExporting(true);
    try {
      const rows = buildVentasExportRows(ventas);
      const filename = `Libro_IVA_Ventas_${selectedPeriod.periodCode}_${consolidado.cuitEmisor.replace(/\D/g, "")}`;
      const success = await downloadXlsx(filename, `Ventas_${selectedPeriod.periodCode}`, rows);
      if (!success) {
        // Fallback CSV
        downloadCsv(`${filename}.csv`, rows);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const exportVentasCsv = () => {
    const rows = buildVentasExportRows(ventas);
    const filename = `Libro_IVA_Ventas_${selectedPeriod.periodCode}_${consolidado.cuitEmisor.replace(/\D/g, "")}.csv`;
    downloadCsv(filename, rows);
  };

  const exportComprasExcel = async () => {
    setIsExporting(true);
    try {
      const rows = buildComprasExportRows(compras);
      const filename = `Libro_IVA_Compras_${selectedPeriod.periodCode}_${consolidado.cuitEmisor.replace(/\D/g, "")}`;
      const success = await downloadXlsx(filename, `Compras_${selectedPeriod.periodCode}`, rows);
      if (!success) {
        downloadCsv(`${filename}.csv`, rows);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const exportComprasCsv = () => {
    const rows = buildComprasExportRows(compras);
    const filename = `Libro_IVA_Compras_${selectedPeriod.periodCode}_${consolidado.cuitEmisor.replace(/\D/g, "")}.csv`;
    downloadCsv(filename, rows);
  };

  const exportConsolidadoExcel = async () => {
    setIsExporting(true);
    try {
      const rows = buildConsolidadoExportRows(consolidado);
      const filename = `Resumen_IVA_Contador_${selectedPeriod.periodCode}`;
      const success = await downloadXlsx(filename, "Resumen F2083", rows);
      if (!success) {
        downloadCsv(`${filename}.csv`, rows);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const exportArcaTxtFiles = () => {
    const pCode = selectedPeriod.periodCode;
    const cuitClean = consolidado.cuitEmisor.replace(/\D/g, "");

    // 1. Ventas Comprobantes
    const vCbte = generateArcaVentasCbteTxt(ventas);
    downloadPlainTxt(`LIBRO_IVA_DIGITAL_VENTAS_CBTE_${pCode}_${cuitClean}.txt`, vCbte);

    // 2. Ventas Alícuotas
    const vAlic = generateArcaVentasAlicuotasTxt(ventas);
    downloadPlainTxt(`LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS_${pCode}_${cuitClean}.txt`, vAlic);

    // 3. Compras Comprobantes
    const cCbte = generateArcaComprasCbteTxt(compras);
    downloadPlainTxt(`LIBRO_IVA_DIGITAL_COMPRAS_CBTE_${pCode}_${cuitClean}.txt`, cCbte);

    // 4. Compras Alícuotas
    const cAlic = generateArcaComprasAlicuotasTxt(compras);
    downloadPlainTxt(`LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS_${pCode}_${cuitClean}.txt`, cAlic);
  };

  const printOfficialReport = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return {
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
    ventas: filteredVentas,
    totalVentasCount: ventas.length,
    compras: filteredCompras,
    totalComprasCount: compras.length,
    reload: loadData,
    exportVentasExcel,
    exportVentasCsv,
    exportComprasExcel,
    exportComprasCsv,
    exportConsolidadoExcel,
    exportArcaTxtFiles,
    printOfficialReport,
  };
};
