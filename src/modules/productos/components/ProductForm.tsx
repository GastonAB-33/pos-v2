import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { VoiceDictationButton } from "@/components/form/VoiceDictationButton";
import type { Product } from "@/types/entities";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/modules/productos/schemas/product-form.schema";

interface ProductFormProps {
  mode: "create" | "edit";
  product?: Product;
  primaryBarcode?: string;
  prefillValues?: Partial<ProductFormValues> | null;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}

const defaultValues: ProductFormValues = {
  name: "",
  brand: "",
  supplier: "",
  barcode: "",
  description: "",
  price: 0,
  cost: 0,
  stockInitial: 0,
  category: "",
  subcategory: "",
  saleMode: "unit",
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
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!product) {
      reset({
        ...defaultValues,
        ...prefillValues,
      });
      return;
    }

    reset({
      name: product.name,
      brand: product.brand ?? "",
      supplier: product.supplier ?? "",
      barcode: primaryBarcode ?? "",
      description: product.description ?? "",
      price: product.price,
      cost: product.cost_price,
      stockInitial: product.stock_current,
      category: product.category,
      subcategory: product.subcategory ?? "",
      saleMode: product.sale_mode,
    });
  }, [prefillValues, primaryBarcode, product, reset]);

  const nameValue = watch("name");
  const descriptionValue = watch("description");

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <VoiceDictationButton
            value={nameValue ?? ""}
            onValueChange={(nextValue) =>
              setValue("name", nextValue, { shouldDirty: true, shouldValidate: true })
            }
            insertMode="replace"
            disabled={disabled}
            label="Dictar nombre de producto"
          />
        </div>
        <input
          {...register("name")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Marca</label>
        <input
          {...register("brand")}
          placeholder="Opcional"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.brand ? <p className="mt-1 text-xs text-red-600">{errors.brand.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Proveedor</label>
        <input
          {...register("supplier")}
          placeholder="Opcional"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.supplier ? <p className="mt-1 text-xs text-red-600">{errors.supplier.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Codigo de barras principal</label>
        <input
          {...register("barcode")}
          placeholder="Opcional"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
        />
        {errors.barcode ? <p className="mt-1 text-xs text-red-600">{errors.barcode.message}</p> : null}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-slate-700">Descripcion</label>
          <VoiceDictationButton
            value={descriptionValue ?? ""}
            onValueChange={(nextValue) =>
              setValue("description", nextValue, { shouldDirty: true, shouldValidate: true })
            }
            insertMode="append"
            disabled={disabled}
            label="Dictar descripcion de producto"
          />
        </div>
        <textarea
          {...register("description")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Precio</label>
          <input
            type="number"
            step="0.01"
            {...register("price")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.price ? <p className="mt-1 text-xs text-red-600">{errors.price.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Costo</label>
          <input
            type="number"
            step="0.01"
            {...register("cost")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.cost ? <p className="mt-1 text-xs text-red-600">{errors.cost.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Stock inicial</label>
          <input
            type="number"
            step="0.001"
            {...register("stockInitial")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.stockInitial ? (
            <p className="mt-1 text-xs text-red-600">{errors.stockInitial.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Unidad o peso</label>
          <select
            {...register("saleMode")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          >
            <option value="unit">Unidad</option>
            <option value="weight">Peso</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Categoria</label>
          <input
            {...register("category")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
          {errors.category ? <p className="mt-1 text-xs text-red-600">{errors.category.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Subcategoria</label>
          <input
            {...register("subcategory")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={disabled}
          />
        </div>
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
    </form>
  );
};
