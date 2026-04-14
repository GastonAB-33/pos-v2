import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import type { Product } from "@/types/entities";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/productos/schemas/product-form.schema";
import {
  computePricingBackward,
  computePricingForward,
  DEFAULT_IVA_PERCENT,
  derivePricingFromStoredProduct,
} from "@/modules/productos/utils/product-pricing";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  primaryBarcode?: string;
  prefillValues?: Partial<ProductFormValues> | null;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}

type CalcMode = "forward" | "backward";

const defaultValues: ProductFormValues = {
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

    reset({
      nombre: product.name,
      codigoBarras: primaryBarcode ?? "",
      codigoProducto: product.code,
      stock: product.stock_current,
      categoria: product.category,
      subcategoria: product.subcategory ?? "",
      precioCosto: product.cost_price,
      porcentajeGanancia: derivedPricing.porcentajeGanancia,
      precioSinIva: derivedPricing.precioSinIva,
      porcentajeIva: derivedPricing.porcentajeIva,
      precioFinal: product.price,
    });
    setCalcMode("forward");
  }, [prefillValues, primaryBarcode, product, reset]);

  const nombre = watch("nombre");
  const precioCosto = watch("precioCosto");
  const porcentajeGanancia = watch("porcentajeGanancia");
  const porcentajeIva = watch("porcentajeIva");
  const precioFinal = watch("precioFinal");

  useEffect(() => {
    const setIfChangedNumber = (
      field: "precioSinIva" | "porcentajeGanancia" | "precioFinal",
      nextValue: number
    ) => {
      const current = getValues(field);
      if (Math.abs(current - nextValue) < 0.005) return;
      setValue(field, nextValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    };

    if (calcMode === "backward") {
      const computed = computePricingBackward({
        precioCosto,
        precioFinal,
        porcentajeIva,
      });

      setIfChangedNumber("precioSinIva", computed.precioSinIva);
      setIfChangedNumber("porcentajeGanancia", computed.porcentajeGanancia);
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

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <VoiceDictationButton
            value={nombre ?? ""}
            onValueChange={(nextValue) =>
              setValue("nombre", nextValue, { shouldDirty: true, shouldValidate: true })
            }
            insertMode="replace"
            disabled={disabled}
            label="Dictar nombre de producto"
          />
        </div>
        <input
          {...register("nombre")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.nombre ? <p className="mt-1 text-xs text-red-600">{errors.nombre.message}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Codigo de barras</label>
          <input
            {...register("codigoBarras")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.codigoBarras ? (
            <p className="mt-1 text-xs text-red-600">{errors.codigoBarras.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Codigo de producto</label>
          <input
            {...register("codigoProducto")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.codigoProducto ? (
            <p className="mt-1 text-xs text-red-600">{errors.codigoProducto.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Stock</label>
          <input
            type="number"
            step="0.001"
            {...register("stock", {
              onChange: () => setCalcMode("forward"),
            })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.stock ? <p className="mt-1 text-xs text-red-600">{errors.stock.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Categoria</label>
          <input
            {...register("categoria")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.categoria ? (
            <p className="mt-1 text-xs text-red-600">{errors.categoria.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subcategoria</label>
          <input
            {...register("subcategoria")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.subcategoria ? (
            <p className="mt-1 text-xs text-red-600">{errors.subcategoria.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Precio costo</label>
          <input
            type="number"
            step="0.01"
            {...register("precioCosto", {
              onChange: () => setCalcMode("forward"),
            })}
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
            {...register("porcentajeGanancia", {
              onChange: () => setCalcMode("forward"),
            })}
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
            {...register("porcentajeIva", {
              onChange: () => setCalcMode("forward"),
            })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
    </form>
  );
};
