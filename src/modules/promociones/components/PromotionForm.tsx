import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { buildPromotionBarcode } from "@/services/promotions.service";
import type { PromotionWithDetails } from "@/services/promotions.service";
import type { Product } from "@/types/entities";
import {
  promotionFormSchema,
  promotionScopeOptions,
  promotionTypeOptions,
  type PromotionFormValues,
} from "@/modules/promociones/schemas/promotion-form.schema";

interface PromotionFormProps {
  mode: "create" | "edit";
  promotion?: PromotionWithDetails;
  products: Product[];
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: (values: PromotionFormValues) => Promise<void>;
}

const defaultValues: PromotionFormValues = {
  name: "",
  code: "",
  barcode: "",
  description: "",
  type: "percentage_discount",
  scope: "product",
  productId: "",
  minQuantity: "",
  discountPercent: "",
  discountAmount: "",
  comboPrice: "",
  startsAt: "",
  endsAt: "",
  bundleItems: [],
};

const toDatetimeLocal = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getTypeLabel = (type: PromotionFormValues["type"]) => {
  switch (type) {
    case "percentage_discount":
      return "Descuento porcentual";
    case "fixed_discount":
      return "Descuento fijo";
    case "combo_price":
      return "Precio combo";
    default:
      return type;
  }
};

const getScopeLabel = (scope: PromotionFormValues["scope"]) => {
  if (scope === "product") return "Producto";
  if (scope === "bundle") return "Combo";
  return "Carrito";
};

export const PromotionForm = ({
  mode,
  promotion,
  products,
  disabled,
  onCancel,
  onSubmit,
}: PromotionFormProps) => {
  const {
    register,
    watch,
    setValue,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!promotion) {
      reset(defaultValues);
      return;
    }

    reset({
      name: promotion.name,
      code: promotion.code,
      barcode: promotion.barcodes?.[0]?.barcode ?? buildPromotionBarcode(promotion.code),
      description: promotion.description ?? "",
      type: promotion.type,
      scope: promotion.scope,
      productId: promotion.product_id ?? "",
      minQuantity: promotion.min_quantity ?? "",
      discountPercent: promotion.discount_percent ?? "",
      discountAmount: promotion.discount_amount ?? "",
      comboPrice: promotion.combo_price ?? "",
      startsAt: toDatetimeLocal(promotion.starts_at),
      endsAt: toDatetimeLocal(promotion.ends_at),
      bundleItems:
        promotion.items?.map((item) => ({
          productId: item.product_id,
          quantity: item.quantity,
        })) ?? [],
    });
  }, [promotion, reset]);

  const selectedType = watch("type");
  const selectedScope = watch("scope");
  const selectedCode = watch("code");
  const { fields, append, remove } = useFieldArray({
    control,
    name: "bundleItems",
  });

  useEffect(() => {
    if (!selectedCode.trim()) return;
    setValue("barcode", buildPromotionBarcode(selectedCode), {
      shouldDirty: mode === "create",
      shouldValidate: true,
    });
  }, [mode, selectedCode, setValue]);

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
          <input {...register("name")} className="ui-input" disabled={disabled} />
          {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Codigo</label>
          <input {...register("code")} className="ui-input" disabled={disabled} />
          {errors.code ? <p className="mt-1 text-xs text-red-600">{errors.code.message}</p> : null}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Barcode promo</label>
          <input {...register("barcode")} className="ui-input font-mono text-sm" disabled={disabled} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Descripcion</label>
        <textarea rows={2} {...register("description")} className="ui-input" disabled={disabled} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
          <select {...register("type")} className="ui-input" disabled={disabled}>
            {promotionTypeOptions.map((type) => (
              <option key={type} value={type}>
                {getTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Alcance</label>
          <select {...register("scope")} className="ui-input" disabled={disabled}>
            {promotionScopeOptions.map((scope) => (
              <option key={scope} value={scope}>
                {getScopeLabel(scope)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedScope === "product" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Producto</label>
          <select {...register("productId")} className="ui-input" disabled={disabled}>
            <option value="">Seleccionar producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          {errors.productId ? (
            <p className="mt-1 text-xs text-red-600">{errors.productId.message}</p>
          ) : null}
        </div>
      ) : null}

      {selectedScope === "bundle" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-700">Productos del combo</label>
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1 text-xs"
              disabled={disabled}
              onClick={() => append({ productId: "", quantity: 1 })}
            >
              Agregar producto
            </button>
          </div>

          <div className="grid gap-2">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
                <select
                  {...register(`bundleItems.${index}.productId`)}
                  className="ui-input"
                  disabled={disabled}
                >
                  <option value="">Seleccionar producto</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  {...register(`bundleItems.${index}.quantity`)}
                  className="ui-input"
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="ui-btn-ghost px-2 py-1 text-xs"
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          {errors.bundleItems ? (
            <p className="mt-2 text-xs text-red-600">{errors.bundleItems.message}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {selectedScope !== "bundle" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cantidad minima</label>
          <input type="number" min="1" step="1" {...register("minQuantity")} className="ui-input" disabled={disabled} />
          {errors.minQuantity ? (
            <p className="mt-1 text-xs text-red-600">{errors.minQuantity.message}</p>
          ) : null}
        </div>
        ) : null}

        {selectedType === "percentage_discount" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Descuento %</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register("discountPercent")}
              className="ui-input"
              disabled={disabled}
            />
            {errors.discountPercent ? (
              <p className="mt-1 text-xs text-red-600">{errors.discountPercent.message}</p>
            ) : null}
          </div>
        ) : null}

        {selectedType === "fixed_discount" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Descuento fijo</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register("discountAmount")}
              className="ui-input"
              disabled={disabled}
            />
            {errors.discountAmount ? (
              <p className="mt-1 text-xs text-red-600">{errors.discountAmount.message}</p>
            ) : null}
          </div>
        ) : null}

        {selectedType === "combo_price" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Precio combo</label>
            <input
              type="number"
              min="0"
              step="0.01"
              {...register("comboPrice")}
              className="ui-input"
              disabled={disabled}
            />
            {errors.comboPrice ? (
              <p className="mt-1 text-xs text-red-600">{errors.comboPrice.message}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Inicio</label>
          <input type="datetime-local" {...register("startsAt")} className="ui-input" disabled={disabled} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Fin</label>
          <input type="datetime-local" {...register("endsAt")} className="ui-input" disabled={disabled} />
          {errors.endsAt ? <p className="mt-1 text-xs text-red-600">{errors.endsAt.message}</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={onCancel} className="ui-btn-ghost" disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary disabled:opacity-60" disabled={disabled}>
          {mode === "create" ? "Crear promocion" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};

