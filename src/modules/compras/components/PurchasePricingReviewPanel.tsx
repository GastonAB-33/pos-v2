import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  DollarSign,
  Info,
  Save,
  Tag,
  User,
  X,
} from "lucide-react";
import type { Purchase, Supplier } from "@/types/entities";
import { computePricingForward, computePricingBackward } from "@/modules/productos/utils/product-pricing";
import { parseInvoicePhotos } from "@/modules/compras/utils/invoice-photos";
import type { PurchaseReviewConfirmationPayload, PurchaseReviewItemPayload } from "@/modules/compras/hooks/usePurchasesModule";

interface PurchasePricingReviewPanelProps {
  purchase: Purchase;
  supplier: Supplier | null;
  usersById?: Record<string, string>;
  disabled?: boolean;
  onBack: () => void;
  onConfirmReview: (payload: PurchaseReviewConfirmationPayload) => Promise<boolean>;
}

interface EditableReviewItem {
  purchaseItemId: string;
  productId: string;
  productName: string;
  currentCatalogStock: number;
  currentCatalogPrice: number;
  // Campos del empleado (resaltados en amarillo y editables por el admin)
  quantity: number;
  bonifiedQuantity: number;
  unitCost: number;
  discountPercent: number;
  // Campos de fijación de venta
  vatPercent: number;
  profitPercent: number;
  newSalePrice: number;
  priceWithoutVat: number;
  updateSalePrice: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const VAT_OPTIONS = [
  { value: 21, label: "21% (General)" },
  { value: 10.5, label: "10.5% (Alimentos/Reducido)" },
  { value: 0, label: "0% (Exento)" },
  { value: 27, label: "27% (Especial/Servicios)" },
];

export const PurchasePricingReviewPanel = ({
  purchase,
  supplier,
  usersById = {},
  disabled,
  onBack,
  onConfirmReview,
}: PurchasePricingReviewPanelProps) => {
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados rápidos en bloque
  const [bulkProfitPercent, setBulkProfitPercent] = useState<string>("");
  const [bulkVatPercent, setBulkVatPercent] = useState<string>("");

  const photos = useMemo(
    () => parseInvoicePhotos(purchase.invoice_photo_url),
    [purchase.invoice_photo_url]
  );

  // Inicializar items de la compra
  const [items, setItems] = useState<EditableReviewItem[]>(() => {
    const rawItems = purchase.items ?? [];
    return rawItems.map((item) => {
      const unitCost = item.unit_cost;
      const currentCatalogPrice = item.sale_price ?? item.product?.price ?? 0;
      const currentCatalogStock = item.product?.stock_current ?? 0;

      // Alícuota inicial: guardada en el ítem, o la del catálogo, o 21% por defecto
      const vatPercent =
        item.vat_percent != null && item.vat_percent >= 0
          ? item.vat_percent
          : item.product?.vat_percent != null && item.product.vat_percent >= 0
          ? item.product.vat_percent
          : 21;

      // Margen inicial: del producto o calcular backward si ya tenía precio
      let profitPercent =
        item.product?.profit_percent != null && item.product.profit_percent > 0
          ? item.product.profit_percent
          : 30;

      if (currentCatalogPrice > 0 && unitCost > 0) {
        const backward = computePricingBackward({
          precioCosto: unitCost,
          precioFinal: currentCatalogPrice,
          porcentajeIva: vatPercent,
        });
        if (backward.porcentajeGanancia > 0) {
          profitPercent = Number(backward.porcentajeGanancia.toFixed(2));
        }
      }

      const forward = computePricingForward({
        precioCosto: unitCost,
        porcentajeGanancia: profitPercent,
        porcentajeIva: vatPercent,
      });

      return {
        purchaseItemId: item.id,
        productId: item.product_id,
        productName: item.product_name_snapshot,
        currentCatalogStock,
        currentCatalogPrice,
        quantity: item.quantity,
        bonifiedQuantity: item.bonified_quantity || 0,
        unitCost: item.unit_cost,
        discountPercent: 0,
        vatPercent,
        profitPercent,
        newSalePrice: Number(forward.precioFinal.toFixed(2)),
        priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        updateSalePrice: true,
      };
    });
  });

  // Nombre del usuario que cargó la compra y fecha formateada
  const loadedByName = purchase.created_by
    ? usersById[purchase.created_by] || purchase.created_by
    : "Empleado del local";

  const loadedAtFormatted = useMemo(() => {
    try {
      const d = new Date(purchase.created_at);
      if (isNaN(d.getTime())) return purchase.created_at;
      return d.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " hs";
    } catch {
      return purchase.created_at;
    }
  }, [purchase.created_at]);

  // Manejadores para modificar datos del empleado
  const handleItemFieldChange = (
    index: number,
    field: "quantity" | "bonifiedQuantity" | "unitCost" | "discountPercent",
    valStr: string
  ) => {
    const val = parseFloat(valStr);
    const safeVal = isNaN(val) || val < 0 ? 0 : val;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [field]: safeVal };
        // Si cambió el costo, recalculamos el precio final con el margen actual
        if (field === "unitCost") {
          const forward = computePricingForward({
            precioCosto: safeVal,
            porcentajeGanancia: updated.profitPercent,
            porcentajeIva: updated.vatPercent,
          });
          updated.newSalePrice = Number(forward.precioFinal.toFixed(2));
          updated.priceWithoutVat = Number(forward.precioSinIva.toFixed(2));
        }
        return updated;
      })
    );
  };

  // Manejadores para fijar precios de venta
  const handleProfitChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr);
    const safeProfit = isNaN(val) ? 0 : val;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: safeProfit,
          porcentajeIva: item.vatPercent,
        });
        return {
          ...item,
          profitPercent: safeProfit,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleSalePriceChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr);
    const safePrice = isNaN(val) ? 0 : val;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const backward = computePricingBackward({
          precioCosto: item.unitCost,
          precioFinal: safePrice,
          porcentajeIva: item.vatPercent,
        });
        return {
          ...item,
          newSalePrice: safePrice,
          profitPercent: Number(backward.porcentajeGanancia.toFixed(2)),
          priceWithoutVat: Number(backward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleVatChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr);
    const safeVat = isNaN(val) ? 0 : val;

    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: item.profitPercent,
          porcentajeIva: safeVat,
        });
        return {
          ...item,
          vatPercent: safeVat,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  // Acciones en bloque
  const handleApplyBulkProfit = () => {
    const p = parseFloat(bulkProfitPercent);
    if (isNaN(p) || p < 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: p,
          porcentajeIva: item.vatPercent,
        });
        return {
          ...item,
          profitPercent: p,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  const handleApplyBulkVat = () => {
    const v = parseFloat(bulkVatPercent);
    if (isNaN(v) || v < 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const forward = computePricingForward({
          precioCosto: item.unitCost,
          porcentajeGanancia: item.profitPercent,
          porcentajeIva: v,
        });
        return {
          ...item,
          vatPercent: v,
          newSalePrice: Number(forward.precioFinal.toFixed(2)),
          priceWithoutVat: Number(forward.precioSinIva.toFixed(2)),
        };
      })
    );
  };

  // Recalcular totales en vivo
  const calculatedSubtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const gross = item.quantity * item.unitCost;
      const savings = gross * (item.discountPercent / 100);
      return acc + (gross - savings);
    }, 0);
  }, [items]);

  const vatTotal = purchase.vat_total || 0;
  const calculatedTotal = calculatedSubtotal + vatTotal;

  const handleSaveProgress = async () => {
    if (!items.length) {
      setError("La compra no tiene productos.");
      return;
    }

    const payloadItems: PurchaseReviewItemPayload[] = items.map((i) => {
      const gross = i.quantity * i.unitCost;
      const savings = gross * (i.discountPercent / 100);
      const lineTotal = Number((gross - savings).toFixed(2));

      return {
        purchaseItemId: i.purchaseItemId,
        productId: i.productId,
        quantity: i.quantity,
        bonifiedQuantity: i.bonifiedQuantity,
        unitCost: i.unitCost,
        discountPercent: i.discountPercent,
        lineTotal,
        vatPercent: i.vatPercent,
        profitPercent: i.profitPercent,
        newSalePrice: i.newSalePrice,
        priceWithoutVat: i.priceWithoutVat,
      };
    });

    const payload: PurchaseReviewConfirmationPayload = {
      purchaseId: purchase.id,
      items: payloadItems,
      subtotal: Number(calculatedSubtotal.toFixed(2)),
      vatTotal: Number(vatTotal.toFixed(2)),
      total: Number(calculatedTotal.toFixed(2)),
      finalize: false,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await onConfirmReview(payload);
      if (ok) {
        onBack();
      } else {
        setError("Error al guardar el progreso. Intenta nuevamente.");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar el progreso de la compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) {
      setError("La compra no tiene productos.");
      return;
    }

    const payloadItems: PurchaseReviewItemPayload[] = items.map((i) => {
      const gross = i.quantity * i.unitCost;
      const savings = gross * (i.discountPercent / 100);
      const lineTotal = Number((gross - savings).toFixed(2));

      return {
        purchaseItemId: i.purchaseItemId,
        productId: i.productId,
        quantity: i.quantity,
        bonifiedQuantity: i.bonifiedQuantity,
        unitCost: i.unitCost,
        discountPercent: i.discountPercent,
        lineTotal,
        vatPercent: i.vatPercent,
        profitPercent: i.profitPercent,
        newSalePrice: i.newSalePrice,
        priceWithoutVat: i.priceWithoutVat,
      };
    });

    const payload: PurchaseReviewConfirmationPayload = {
      purchaseId: purchase.id,
      items: payloadItems,
      subtotal: Number(calculatedSubtotal.toFixed(2)),
      vatTotal: Number(vatTotal.toFixed(2)),
      total: Number(calculatedTotal.toFixed(2)),
      finalize: true,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await onConfirmReview(payload);
      if (ok) {
        onBack();
      } else {
        setError("Error al confirmar la compra. Intenta nuevamente.");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo completar la 2da confirmación de compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 1. Header con botones volver, guardar y título */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver</span>
            </button>
            <button
              type="button"
              onClick={handleSaveProgress}
              disabled={isSubmitting || disabled}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Guardar progreso</span>
            </button>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                2da Confirmación: {purchase.document_number ? `${purchase.document_type || "Factura"} Nº ${purchase.document_number}` : purchase.purchase_number}
              </h1>
              {purchase.document_number && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  ({purchase.purchase_number})
                </span>
              )}
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                Pendiente fijar precios
              </span>
            </div>
          </div>
        </div>

        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => setPhotoViewerIndex(0)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/50 dark:text-brand-300 shadow-2xs transition cursor-pointer"
          >
            <Camera className="h-4 w-4" />
            <span>Ver factura física ({photos.length})</span>
          </button>
        )}
      </div>

      {/* 2. Tarjeta de Auditoría del Empleado y Alerta Informativa */}
      <div className="rounded-2xl border border-amber-300/80 bg-amber-50/50 p-4 dark:border-amber-800/80 dark:bg-amber-950/20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/70 dark:border-amber-900/60 pb-3">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold shrink-0">
              <User className="h-4 w-4" />
            </span>
            <div>
              <span className="block font-medium text-[11px] text-amber-700 dark:text-amber-400">
                Auditoría de carga
              </span>
              <span className="font-bold">
                Cargada por <strong className="underline">{loadedByName}</strong> el {loadedAtFormatted}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
            <div>
              <span className="text-[11px] text-slate-400 block">Proveedor:</span>
              <strong className="font-semibold">{supplier?.name || "Sin proveedor"}</strong>
            </div>
            <div className="pl-3 border-l border-amber-200 dark:border-amber-800">
              <span className="text-[11px] text-slate-400 block">Comprobante:</span>
              <strong className="font-semibold">
                {purchase.document_type || "Factura"} {purchase.document_number ? `Nº ${purchase.document_number}` : ""}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p>
            Los datos cargados por el empleado están <strong>resaltados en amarillo suave</strong>. Puedes corregir cualquier dato si hubo un error en la carga (cantidades, costos, descuentos) y completar las alícuotas de IVA y márgenes de ganancia definitivos.
          </p>
        </div>
      </div>

      {/* 3. Barra de Acciones Globales Rápidas (Margen global e IVA global) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Ajustes en bloque ({items.length} productos):
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Margen global:</span>
            <div className="relative w-24">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="35"
                value={bulkProfitPercent}
                onChange={(e) => setBulkProfitPercent(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-xs px-2 pr-6 text-right font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                %
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyBulkProfit}
              disabled={!bulkProfitPercent}
              className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Aplicar
            </button>
          </div>

          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">IVA global:</span>
            <select
              value={bulkVatPercent}
              onChange={(e) => setBulkVatPercent(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-xs px-2 font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="">Seleccionar</option>
              <option value="21">21% General</option>
              <option value="10.5">10.5% Alimentos</option>
              <option value="0">0% Exento</option>
              <option value="27">27% Especial</option>
            </select>
            <button
              type="button"
              onClick={handleApplyBulkVat}
              disabled={!bulkVatPercent}
              className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Lista Completa de Productos de la Compra */}
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
        <div className="space-y-3">
          {items.map((item, index) => {
            const grossLineTotal = item.quantity * item.unitCost;
            const lineSavings = grossLineTotal * (item.discountPercent / 100);
            const lineTotal = grossLineTotal - lineSavings;
            const diffPercent =
              item.currentCatalogPrice > 0
                ? ((item.newSalePrice - item.currentCatalogPrice) / item.currentCatalogPrice) * 100
                : null;
            const netMargin = Math.max(0, item.priceWithoutVat - item.unitCost);

            return (
              <article
                key={item.purchaseItemId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors"
              >
                {/* Encabezado del Producto */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0">
                      #{index + 1}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {item.productName}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Stock en catálogo: <strong className="text-slate-800 dark:text-slate-200">{item.currentCatalogStock} u.</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Precio actual: <strong className="text-slate-700 dark:text-slate-300">{item.currentCatalogPrice > 0 ? currency.format(item.currentCatalogPrice) : "Sin precio"}</strong>
                    </span>
                  </div>
                </div>

                {/* Doble Bloque: Datos del Empleado (Amarillo) vs Fijación de Venta (Púrpura/Azul) */}
                <div className="mt-3 grid grid-cols-1 xl:grid-cols-12 gap-3.5">
                  {/* BLOQUE 1: DATOS INGRESADOS POR EL EMPLEADO (RESALTADOS EN AMARILLO SUAVE) */}
                  <div className="xl:col-span-6 rounded-xl border border-amber-300/80 bg-amber-50/40 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1">
                        <Tag className="h-3 w-3 text-amber-600" />
                        Datos del remito / factura (Empleado)
                      </span>
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                        Editable si hay error
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Cantidad */}
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                          CANT. PAGAR
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleItemFieldChange(index, "quantity", e.target.value)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-amber-100/60 dark:border-amber-700 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-2 text-xs font-black text-right outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Precio Costo Unitario */}
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                          PRECIO COSTO
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => handleItemFieldChange(index, "unitCost", e.target.value)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-amber-100/60 dark:border-amber-700 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-2 text-xs font-black text-right outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Bonificadas */}
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                          BONIF. (U.)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.bonifiedQuantity}
                          onChange={(e) => handleItemFieldChange(index, "bonifiedQuantity", e.target.value)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-amber-100/60 dark:border-amber-700 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-2 text-xs font-black text-right outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Descuento Proveedor % */}
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                          DESC. PROV. %
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={(e) => handleItemFieldChange(index, "discountPercent", e.target.value)}
                          className="w-full h-8 rounded-lg border border-amber-300 bg-amber-100/60 dark:border-amber-700 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100 px-2 text-xs font-black text-right outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 pt-1 border-t border-amber-200/60 dark:border-amber-900/50">
                      <span>Subtotal: {currency.format(grossLineTotal)}</span>
                      <span className="font-bold">Total a pagar: {currency.format(lineTotal)}</span>
                    </div>
                  </div>

                  {/* BLOQUE 2: FIJACIÓN DE PRECIOS DE VENTA (ADMINISTRADOR) */}
                  <div className="xl:col-span-6 rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/20 p-3 dark:bg-purple-950/15">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-purple-600" />
                        Fijación de Venta al Público (Administrador)
                      </span>
                      {diffPercent != null && isFinite(diffPercent) && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            diffPercent > 0
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : diffPercent < 0
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          Variación: {diffPercent > 0 ? `+${diffPercent.toFixed(1)}%` : `${diffPercent.toFixed(1)}%`}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Alícuota IVA Venta */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          IVA VENTA
                        </label>
                        <select
                          value={item.vatPercent}
                          onChange={(e) => handleVatChange(index, e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 px-2 outline-none focus:border-brand-500 cursor-pointer"
                        >
                          {VAT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Margen de Ganancia % */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          GANANCIA %
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.profitPercent}
                            onChange={(e) => handleProfitChange(index, e.target.value)}
                            className="w-full h-8 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 px-2 pr-5 text-right outline-none focus:border-brand-500"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>

                      {/* Precio Final de Venta */}
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                          PRECIO FINAL ($/U)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xs pointer-events-none">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.newSalePrice}
                            onChange={(e) => handleSalePriceChange(index, e.target.value)}
                            className="w-full h-8 rounded-lg border border-emerald-400 bg-white dark:border-emerald-600 dark:bg-slate-900 text-xs font-black text-emerald-700 dark:text-emerald-300 pl-5 pr-2 text-right outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-purple-100 dark:border-purple-900/50">
                      <span>Sin IVA: {currency.format(item.priceWithoutVat)}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Ganancia neta: +{currency.format(netMargin)}/u
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* 5. Footer con Resumen de Factura y Botones Finales */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <div>
              <span className="text-slate-400 font-normal block text-[11px]">Subtotal neto:</span>
              <span>{currency.format(calculatedSubtotal)}</span>
            </div>
            {vatTotal > 0 && (
              <div className="pl-3 border-l border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 font-normal block text-[11px]">IVA compras:</span>
                <span>+{currency.format(vatTotal)}</span>
              </div>
            )}
            <div className="pl-3 border-l border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 font-normal block text-[11px]">Total de la compra:</span>
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                {currency.format(calculatedTotal)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Volver sin guardar
            </button>
            <button
              type="button"
              onClick={handleSaveProgress}
              disabled={isSubmitting || disabled}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-4 py-2.5 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>
                {isSubmitting ? "Guardando..." : "Guardar progreso y volver"}
              </span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting || disabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white hover:bg-emerald-500 active:scale-98 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? "Confirmando y actualizando precios..."
                  : "Confirmar Precios y Finalizar Compra"}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* Lightbox / Visor de Fotografías de la Factura Física */}
      {photoViewerIndex !== null && photos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-2 shadow-2xl">
            <div className="flex items-center justify-between p-2 text-white border-b border-slate-800 mb-2">
              <span className="text-xs font-bold">
                Factura física adjunta ({photoViewerIndex + 1} de {photos.length})
              </span>
              <button
                type="button"
                onClick={() => setPhotoViewerIndex(null)}
                className="rounded-lg p-1 hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={photos[photoViewerIndex]}
              alt="Factura"
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};
