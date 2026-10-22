import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import {
  convertSpokenBarcode,
  convertSpokenProductCode,
} from "@/features/voice/utils/voice-normalizer";
import type { Product } from "@/types/entities";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/productos/schemas/product-form.schema";
import {
  computePricingForward,
  computePricingReverse,
  DEFAULT_IVA_PERCENT,
  derivePricingFromStoredProduct,
} from "@/modules/productos/utils/product-pricing";
import { handleNumericInputFocus, handleNumericInputBlur, parseNumericField } from "@/utils/input-helpers";
import { parseReturnableConfig, COMMON_RETURNABLE_PACKAGES, useTenantReturnablePackages } from "@/utils/returnable-packages";
import { useTenant } from "@/features/tenant/hooks/useTenant";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  primaryBarcode?: string;
  prefillValues?: Partial<ProductFormValues> | null;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}

type CalcMode = "forward" | "reverse";

const defaultValues: ProductFormValues = {
  nombre: "",
  saleMode: "unit",
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
  isReturnable: false,
  returnablePackageName: "",
  returnablePackagePrice: 0,
  trackStock: true,
};

export const ProductForm = ({
  mode,
  product,
  primaryBarcode,
  prefillValues,
  disabled,
  onCancel,
  onSubmit,
}: ProductFormProps) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  const [calcMode, setCalcMode] = useState<CalcMode>("forward");
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!product) {
      reset({
        ...defaultValues,
        ...prefillValues,
      });
      setCalcMode("forward");
      return;
    }

    const derivedPricing = derivePricingFromStoredProduct({
      precioCosto: product.cost_price,
      precioFinal: product.price,
      porcentajeIva: product.vat_percent,
      porcentajeGanancia: product.profit_percent,
      precioSinIva: product.price_without_vat,
    });

    const returnableConfig = parseReturnableConfig(product.description);
    const isWeight = product.sale_mode === "weight";
    const initialStock = isWeight ? Number((product.stock_current * 1000).toFixed(3)) : product.stock_current;

    reset({
      nombre: product.name,
      saleMode: product.sale_mode,
      codigoBarras: primaryBarcode ?? "",
      codigoProducto: product.code ?? "",
      stock: initialStock,
      categoria: product.category,
      subcategoria: product.subcategory ?? "",
      precioCosto: product.cost_price,
      porcentajeGanancia: derivedPricing.porcentajeGanancia,
      precioSinIva: derivedPricing.precioSinIva,
      porcentajeIva: derivedPricing.porcentajeIva,
      precioFinal: product.price,
      isReturnable: returnableConfig?.enabled ?? false,
      returnablePackageName: returnableConfig?.packageName ?? "",
      returnablePackagePrice: returnableConfig?.packagePrice ?? 0,
    });
    setCalcMode("forward");
  }, [prefillValues, primaryBarcode, product, reset]);

  const nombre = watch("nombre");
  const saleMode = watch("saleMode");
  const { tenantId } = useTenant();
  const { packages: tenantPackages } = useTenantReturnablePackages(tenantId);
  const availableReturnables = tenantPackages.length > 0 ? tenantPackages : COMMON_RETURNABLE_PACKAGES;
  const precioCosto = watch("precioCosto");
  const porcentajeGanancia = watch("porcentajeGanancia");
  const porcentajeIva = watch("porcentajeIva");
  const precioFinal = watch("precioFinal");

  const codigoBarras = watch("codigoBarras");
  const codigoProducto = watch("codigoProducto");

  useEffect(() => {
    const setIfChangedNumber = (
      field: "precioSinIva" | "porcentajeGanancia" | "precioFinal" | "precioCosto",
      nextValue: number
    ) => {
      const current = getValues(field);
      if (Math.abs(current - nextValue) < 0.005) return;
      setValue(field, nextValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    };

    if (calcMode === "reverse") {
      const computed = computePricingReverse({
        precioFinal,
        porcentajeGanancia,
        porcentajeIva,
      });

      setIfChangedNumber("precioSinIva", computed.precioSinIva);
      setIfChangedNumber("precioCosto", computed.precioCosto);
      return;
    }

    const computed = computePricingForward({
      precioCosto,
      porcentajeGanancia,
      porcentajeIva,
    });

    setIfChangedNumber("precioSinIva", computed.precioSinIva);
    setIfChangedNumber("precioFinal", computed.precioFinal);
  }, [calcMode, getValues, porcentajeGanancia, porcentajeIva, precioCosto, precioFinal, setValue]);

  const submitForm = (values: ProductFormValues) => {
    const isWeight = values.saleMode === "weight";
    const stockToSubmit = isWeight ? Number((values.stock / 1000).toFixed(4)) : values.stock;
    onSubmit({
      ...values,
      stock: stockToSubmit,
    });
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(submitForm)}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Nombre del producto</label>
        <div className="flex items-center gap-2">
          <input
            {...register("nombre")}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-form-type="other"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          <VoiceDictationButton
            value={nombre}
            onValueChange={(nextValue) =>
              setValue("nombre", nextValue, { shouldDirty: true, shouldValidate: true })
            }
            disabled={disabled}
          />
        </div>
        {errors.nombre ? <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código de barras</label>
          <div className="flex items-center gap-2">
            <input
              {...register("codigoBarras")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={disabled}
            />
            <VoiceDictationButton
              value={codigoBarras ?? ""}
              onValueChange={(nextValue) =>
                setValue("codigoBarras", convertSpokenBarcode(nextValue), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              insertMode="replace"
              fieldType="barcode"
              disabled={disabled}
              label="Dictar código de barras"
            />
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700"
              onClick={() => setScannerOpen(true)}
              disabled={disabled}
            >
              Cámara
            </button>
          </div>
          {errors.codigoBarras ? (
            <p className="mt-1 text-xs text-red-600">{errors.codigoBarras.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Código de producto</label>
          <div className="flex items-center gap-2">
            <input
              {...register("codigoProducto")}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={disabled}
            />
            <VoiceDictationButton
              value={codigoProducto ?? ""}
              onValueChange={(nextValue) =>
                setValue("codigoProducto", convertSpokenProductCode(nextValue), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              insertMode="replace"
              fieldType="code"
              disabled={disabled}
              label="Dictar código de producto"
            />
          </div>
          {errors.codigoProducto ? (
            <p className="mt-1 text-xs text-red-600">{errors.codigoProducto.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {saleMode === "weight" ? "Stock en gramos (g)" : "Stock en unidades"}
          </label>
          <input
            type="number"
            step={saleMode === "weight" ? "1" : "0.001"}
            placeholder="0"
            {...register("stock", {
              setValueAs: parseNumericField,
              onChange: () => setCalcMode("forward"),
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: mode === "create",
                onClear: () => setValue("stock", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("stock", 0);
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.stock ? <p className="mt-1 text-xs text-red-600">{errors.stock.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Categoría <span className="text-red-500">*</span>
          </label>
          <input
            {...register("categoria")}
            placeholder="Seleccionar o escribir categoría..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.categoria ? (
            <p className="mt-1 text-xs text-red-600">{errors.categoria.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subcategoría</label>
          <input
            {...register("subcategoria")}
            placeholder="Seleccionar o escribir subcategoría..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.subcategoria ? (
            <p className="mt-1 text-xs text-red-600">{errors.subcategoria.message}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Tipo de venta</label>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="radio" value="unit" {...register("saleMode")} disabled={disabled} />
            <span>
              <span className="block font-semibold text-slate-900">Por unidad</span>
              <span className="text-xs text-slate-500">Precio y stock por unidades.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
            <input type="radio" value="weight" {...register("saleMode")} disabled={disabled} />
            <span>
              <span className="block font-semibold text-slate-900">Pesable</span>
              <span className="text-xs text-slate-500">Precio por kg, stock en gramos y venta por gramos.</span>
            </span>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {saleMode === "weight" ? "Precio costo por kg" : "Precio costo"}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("precioCosto", {
              setValueAs: parseNumericField,
              onChange: () => setCalcMode("forward"),
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: mode === "create",
                onClear: () => setValue("precioCosto", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("precioCosto", 0);
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.precioCosto ? (
            <p className="mt-1 text-xs text-red-600">{errors.precioCosto.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Porcentaje ganancia (%)</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("porcentajeGanancia", {
              setValueAs: parseNumericField,
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: mode === "create",
                onClear: () => setValue("porcentajeGanancia", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("porcentajeGanancia", 0);
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.porcentajeGanancia ? (
            <p className="mt-1 text-xs text-red-600">{errors.porcentajeGanancia.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Precio sin IVA</label>
          <input
            type="number"
            step="0.01"
            {...register("precioSinIva")}
            readOnly
            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.precioSinIva ? (
            <p className="mt-1 text-xs text-red-600">{errors.precioSinIva.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Porcentaje IVA (%)</label>
          <input
            type="number"
            step="0.01"
            placeholder="21"
            {...register("porcentajeIva", {
              setValueAs: parseNumericField,
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: false,
              })
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.porcentajeIva ? (
            <p className="mt-1 text-xs text-red-600">{errors.porcentajeIva.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {saleMode === "weight" ? "Precio final por kg" : "Precio final"}
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("precioFinal", {
              setValueAs: parseNumericField,
              onChange: () => setCalcMode("reverse"),
            })}
            onFocus={(e) =>
              handleNumericInputFocus(e, {
                isNew: mode === "create",
                onClear: () => setValue("precioFinal", "" as any),
              })
            }
            onBlur={(e) => {
              handleNumericInputBlur(e, "0", () => {
                setValue("precioFinal", 0);
              });
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.precioFinal ? (
            <p className="mt-1 text-xs text-red-600">{errors.precioFinal.message}</p>
          ) : null}
        </div>
      </div>

      <p className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
        Si modificas costo, ganancia o IVA se recalculan precio sin IVA y precio final. Si editas precio final manualmente,
        se recalcula la ganancia en forma inversa respetando el IVA.
      </p>

      {/* Sección: Envase Retornable */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("isReturnable")}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                disabled={disabled}
              />
              <span>¿Requiere envase retornable?</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Para gaseosas, cervezas, bidones de agua o garrafas de gas con seña o canje.
            </p>
          </div>
        </div>

        {watch("isReturnable") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo o nombre del envase
              </label>
              <input
                type="text"
                list="common-packages"
                placeholder="Ej: Garrafa 10kg, Bidón 20L..."
                {...register("returnablePackageName")}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                disabled={disabled}
              />
              <datalist id="common-packages">
                {availableReturnables.map((pkg) => (
                  <option key={pkg.name} value={pkg.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Precio si no trae envase ($ seña / depósito)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("returnablePackagePrice", { setValueAs: parseNumericField })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          disabled={disabled}
        >
          {mode === "create" ? "Crear producto" : "Guardar cambios"}
        </button>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        title="Escanear codigo de barras del producto"
        onClose={() => setScannerOpen(false)}
        onDetected={(barcode) => {
          setValue("codigoBarras", barcode, { shouldDirty: true, shouldValidate: true });
          setScannerOpen(false);
        }}
      />
    </form>
  );
};
