import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import {
  computePricingBackward,
  computePricingForward,
  DEFAULT_IVA_PERCENT,
} from "@/modules/productos/utils/product-pricing";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/productos/schemas/product-form.schema";
import type { ProductFormModalValues, ProductViewModel } from "@/modules/productos/types/product.types";

type CalcMode = "forward" | "backward";

interface ProductFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  product?: ProductViewModel | null;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (values: ProductFormModalValues) => Promise<void>;
}

const baseDefaults: ProductFormValues = {
  nombre: "",
  codigoBarras: "",
  codigoProducto: "",
  stock: 0,
  categoria: "",
  subcategoria: "",
  precioCosto: 0,
  porcentajeGanancia: 0,
  precioSinIva: 0,
  porcentajeIva: DEFAULT_IVA_PERCENT,
  precioFinal: 0,
};

const defaults: ProductFormModalValues = {
  ...baseDefaults,
  favorito: false,
  estadoActivo: true,
};

const productFormModalSchema = productFormSchema.extend({
  favorito: z.boolean(),
  estadoActivo: z.boolean(),
});

export const ProductFormModal = ({
  open,
  mode,
  product,
  disabled,
  onClose,
  onSubmit,
}: ProductFormModalProps) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductFormModalValues>({
    resolver: zodResolver(productFormModalSchema),
    defaultValues: defaults,
  });

  const [calcMode, setCalcMode] = useState<CalcMode>("forward");
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (!product) {
      reset(defaults);
      setCalcMode("forward");
      return;
    }

    reset({
      nombre: product.nombre,
      codigoBarras: product.codigoBarras,
      codigoProducto: product.codigoProducto,
      stock: product.stock,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
      precioCosto: product.precioCosto,
      porcentajeGanancia: product.porcentajeGanancia,
      precioSinIva: product.precioSinIva,
      porcentajeIva: product.porcentajeIva,
      precioFinal: product.precioFinal,
      favorito: product.favorito,
      estadoActivo: product.activo,
    });
    setCalcMode("forward");
  }, [open, product, reset]);

  const precioCosto = watch("precioCosto");
  const porcentajeGanancia = watch("porcentajeGanancia");
  const porcentajeIva = watch("porcentajeIva");
  const precioFinal = watch("precioFinal");

  useEffect(() => {
    if (!open) return;

    const setIfChanged = (field: "precioSinIva" | "precioFinal" | "porcentajeGanancia", value: number) => {
      const current = getValues(field);
      if (Math.abs(current - value) < 0.005) return;
      setValue(field, value, { shouldDirty: true, shouldValidate: true });
    };

    if (calcMode === "backward") {
      const next = computePricingBackward({
        precioCosto,
        precioFinal,
        porcentajeIva,
      });

      setIfChanged("precioSinIva", next.precioSinIva);
      setIfChanged("porcentajeGanancia", next.porcentajeGanancia);
      return;
    }

    const next = computePricingForward({
      precioCosto,
      porcentajeGanancia,
      porcentajeIva,
    });

    setIfChanged("precioSinIva", next.precioSinIva);
    setIfChanged("precioFinal", next.precioFinal);
  }, [calcMode, getValues, open, porcentajeGanancia, porcentajeIva, precioCosto, precioFinal, setValue]);

  const title = useMemo(
    () => (mode === "create" ? "Nuevo Producto" : "Editar Producto"),
    [mode]
  );

  const handleFormSubmit = async (values: ProductFormModalValues) => {
    const pricing =
      calcMode === "backward"
        ? computePricingBackward({
            precioCosto: values.precioCosto,
            precioFinal: values.precioFinal,
            porcentajeIva: values.porcentajeIva,
          })
        : computePricingForward({
            precioCosto: values.precioCosto,
            porcentajeGanancia: values.porcentajeGanancia,
            porcentajeIva: values.porcentajeIva,
          });

    await onSubmit({
      ...values,
      codigoBarras: values.codigoBarras?.trim() ?? "",
      codigoProducto: values.codigoProducto?.trim() ?? "",
      precioSinIva: pricing.precioSinIva,
      precioFinal: pricing.precioFinal,
      porcentajeGanancia: pricing.porcentajeGanancia,
    });
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-panel md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              Completa los datos y el sistema calculará precios automáticamente.
            </p>
          </div>
          <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={disabled}>
            Cerrar
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
              <input {...register("nombre")} className="ui-input" disabled={disabled} />
              {errors.nombre ? <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Stock</label>
              <input
                type="number"
                step="0.001"
                {...register("stock", {
                  onChange: () => setCalcMode("forward"),
                })}
                className="ui-input"
                disabled={disabled}
              />
              {errors.stock ? <p className="mt-1 text-xs text-red-600">{errors.stock.message}</p> : null}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">Código de barras</label>
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  onClick={() => setScannerOpen(true)}
                  disabled={disabled}
                >
                  Escanear cámara
                </button>
              </div>
              <input {...register("codigoBarras")} className="ui-input" disabled={disabled} />
              {errors.codigoBarras ? (
                <p className="mt-1 text-xs text-red-600">{errors.codigoBarras.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Código de producto</label>
              <input {...register("codigoProducto")} className="ui-input" disabled={disabled} />
              {errors.codigoProducto ? (
                <p className="mt-1 text-xs text-red-600">{errors.codigoProducto.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
              <input {...register("categoria")} className="ui-input" disabled={disabled} />
              {errors.categoria ? <p className="mt-1 text-xs text-red-600">{errors.categoria.message}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subcategoría</label>
              <input {...register("subcategoria")} className="ui-input" disabled={disabled} />
              {errors.subcategoria ? (
                <p className="mt-1 text-xs text-red-600">{errors.subcategoria.message}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Precios y cálculo</h4>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio de costo</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioCosto", {
                    onChange: () => setCalcMode("forward"),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.precioCosto ? (
                  <p className="mt-1 text-xs text-red-600">{errors.precioCosto.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">% Ganancia</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("porcentajeGanancia", {
                    onChange: () => setCalcMode("forward"),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.porcentajeGanancia ? (
                  <p className="mt-1 text-xs text-red-600">{errors.porcentajeGanancia.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio sin IVA</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioSinIva")}
                  readOnly
                  className="ui-input bg-slate-100"
                  disabled={disabled}
                />
                {errors.precioSinIva ? (
                  <p className="mt-1 text-xs text-red-600">{errors.precioSinIva.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">% IVA</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("porcentajeIva", {
                    onChange: () => setCalcMode("forward"),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.porcentajeIva ? (
                  <p className="mt-1 text-xs text-red-600">{errors.porcentajeIva.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio final</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("precioFinal", {
                    onChange: () => setCalcMode("backward"),
                  })}
                  className="ui-input"
                  disabled={disabled}
                />
                {errors.precioFinal ? (
                  <p className="mt-1 text-xs text-red-600">{errors.precioFinal.message}</p>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Si editas el precio final, se recalcula la ganancia de forma inversa. Si el costo es 0, se evita dividir por cero.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" {...register("favorito")} disabled={disabled} />
              Marcar como favorito para POS
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" {...register("estadoActivo")} disabled={disabled} />
              Producto activo
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <button type="button" className="ui-btn-ghost" onClick={onClose} disabled={disabled}>
              Cancelar
            </button>
            <button type="submit" className="ui-btn-primary" disabled={disabled}>
              {mode === "create" ? "Crear producto" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        title="Escanear código de barras del producto"
        onClose={() => setScannerOpen(false)}
        onDetected={(barcode) => {
          setValue("codigoBarras", barcode, { shouldDirty: true, shouldValidate: true });
          setScannerOpen(false);
        }}
      />
    </section>
  );
};
