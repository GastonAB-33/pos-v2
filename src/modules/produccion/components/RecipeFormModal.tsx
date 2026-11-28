import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Sparkles, Trash2, UtensilsCrossed } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  calculateRecipeFinancials,
  convertInputToStockQuantity,
  type RecipeItemDraft,
  type SaveRecipePayload,
} from "@/services/production.service";
import type { EnrichedRecipe } from "@/modules/produccion/hooks/useProductionModule";
import type { Product, RecipeInputUnit, RecipeYieldUnit } from "@/types/entities";

interface RecipeFormModalProps {
  open: boolean;
  editing: EnrichedRecipe | null;
  products: Product[];
  productsById: Map<string, Product>;
  recipeProductIdsSet?: Set<string>;
  categories: string[];
  isSubmitting: boolean;
  onClose: () => void;
  onCreateProduct: (input: {
    name: string;
    category: string;
    price: number;
    saleMode: "unit" | "weight";
    code?: string;
  }) => Promise<Product | null>;
  onSave: (payload: SaveRecipePayload) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const RecipeFormModal = ({
  open,
  editing,
  products,
  productsById,
  recipeProductIdsSet,
  categories,
  isSubmitting,
  onClose,
  onCreateProduct,
  onSave,
}: RecipeFormModalProps) => {
  useBodyScrollLock(open);

  const [productMode, setProductMode] = useState<"existing" | "new">("existing");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [newProdName, setNewProdName] = useState<string>("");
  const [newProdCategory, setNewProdCategory] = useState<string>("Elaborados");
  const [newProdSaleMode, setNewProdSaleMode] = useState<"unit" | "weight">("unit");
  const [newProdCode, setNewProdCode] = useState<string>("");

  const [recipeName, setRecipeName] = useState<string>("");
  const [batchYield, setBatchYield] = useState<string>("1");
  const [yieldUnit, setYieldUnit] = useState<RecipeYieldUnit>("unit");
  const [indirectCost, setIndirectCost] = useState<string>("0");
  const [targetSalePrice, setTargetSalePrice] = useState<string>("0");
  const [syncProductPricing, setSyncProductPricing] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");

  const [items, setItems] = useState<RecipeItemDraft[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState<string>("");
  const [isCategoryOpen, setIsCategoryOpen] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setIngredientSearch("");

    if (editing) {
      setProductMode("existing");
      setSelectedProductId(editing.recipe.product_id);
      setRecipeName(editing.recipe.name);
      setBatchYield(String(editing.recipe.batch_yield));
      setYieldUnit(editing.recipe.yield_unit);
      setIndirectCost(String(editing.recipe.indirect_cost || 0));
      setTargetSalePrice(String(editing.finishedProduct?.price ?? 0));
      setSyncProductPricing(true);
      setNotes(editing.recipe.notes ?? "");
      setItems(
        editing.items.map((i) => ({
          ingredient_product_id: i.ingredient_product_id,
          quantity_per_batch: i.quantity_per_batch,
          input_unit: i.input_unit,
        }))
      );
    } else {
      setProductMode("new");
      setSelectedProductId(products[0]?.id ?? "");
      setNewProdName("");
      setNewProdCategory("Elaborados");
      setNewProdSaleMode("unit");
      setNewProdCode("");
      setRecipeName("");
      setBatchYield("10");
      setYieldUnit("unit");
      setIndirectCost("0");
      setTargetSalePrice("0");
      setSyncProductPricing(true);
      setNotes("");
      setItems([]);
    }
  }, [open, editing, products]);

  // Cuando cambia el producto existente seleccionado, sugerir nombre y precio
  const handleSelectExistingProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = productsById.get(prodId);
    if (prod) {
      if (!recipeName.trim()) setRecipeName(prod.name);
      setTargetSalePrice(String(prod.price ?? 0));
      setYieldUnit(prod.sale_mode === "weight" ? "kg" : "unit");
    }
  };

  const filteredIngredients = useMemo(() => {
    const term = ingredientSearch.trim().toLowerCase();
    if (!term) return [];
    const excludedId = productMode === "existing" ? selectedProductId : "";
    return products
      .filter(
        (p) =>
          p.id !== excludedId &&
          (p.name.toLowerCase().includes(term) ||
            (p.code && p.code.toLowerCase().includes(term)))
      )
      .slice(0, 8);
  }, [ingredientSearch, products, productMode, selectedProductId]);

  const handleAddIngredient = (ing: Product) => {
    setItems((prev) => {
      if (prev.some((i) => i.ingredient_product_id === ing.id)) return prev;
      const defaultUnit: RecipeInputUnit = ing.sale_mode === "weight" ? "g" : "unit";
      return [
        ...prev,
        {
          ingredient_product_id: ing.id,
          quantity_per_batch: ing.sale_mode === "weight" ? 250 : 1,
          input_unit: defaultUnit,
        },
      ];
    });
    setIngredientSearch("");
  };

  const updateItem = (
    ingId: string,
    patch: Partial<Pick<RecipeItemDraft, "quantity_per_batch" | "input_unit">>
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.ingredient_product_id === ingId ? { ...i, ...patch } : i))
    );
  };

  const removeItem = (ingId: string) => {
    setItems((prev) => prev.filter((i) => i.ingredient_product_id !== ingId));
  };

  const safeYield = Math.max(0.001, Number(batchYield) || 1);

  const financials = useMemo(() => {
    const mockFinished: Product | undefined =
      productMode === "existing"
        ? productsById.get(selectedProductId)
        : undefined;
    const simulatedProduct: Product | undefined = mockFinished
      ? { ...mockFinished, price: Number(targetSalePrice) || 0 }
      : ({
          price: Number(targetSalePrice) || 0,
        } as Product);

    return calculateRecipeFinancials(
      {
        batch_yield: safeYield,
        indirect_cost: Number(indirectCost) || 0,
      },
      items,
      simulatedProduct,
      productsById
    );
  }, [
    productMode,
    productsById,
    selectedProductId,
    targetSalePrice,
    safeYield,
    indirectCost,
    items,
  ]);

  if (!open) return null;

  const unitLabel = yieldUnit === "kg" ? "kg" : "u.";
  const batchSaleTotal = Number(((Number(targetSalePrice) || 0) * safeYield).toFixed(2));
  const batchProfit = Number((batchSaleTotal - financials.totalCostPerBatch).toFixed(2));
  const filteredCategories = categories.filter((c) =>
    c.toLowerCase().includes(newProdCategory.trim().toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (items.length === 0) {
      setFormError("Agregá al menos un insumo o materia prima a la receta.");
      return;
    }

    let finalProductId = selectedProductId;
    let finalRecipeName = recipeName.trim();

    if (productMode === "new") {
      if (!newProdName.trim()) {
        setFormError("Ingresá el nombre del artículo elaborado a crear.");
        return;
      }
      const created = await onCreateProduct({
        name: newProdName.trim(),
        category: newProdCategory.trim() || "Elaborados",
        price: Number(targetSalePrice) || 0,
        saleMode: newProdSaleMode,
        code: newProdCode.trim() || undefined,
      });
      if (!created) {
        setFormError("No se pudo crear el producto terminado.");
        return;
      }
      finalProductId = created.id;
      if (!finalRecipeName) finalRecipeName = created.name;
    } else {
      if (!finalProductId) {
        setFormError("Seleccioná el producto terminado.");
        return;
      }
      if (!finalRecipeName) {
        finalRecipeName = productsById.get(finalProductId)?.name ?? "Receta";
      }
    }

    const ok = await onSave({
      id: editing?.recipe.id,
      product_id: finalProductId,
      name: finalRecipeName,
      batch_yield: safeYield,
      yield_unit: yieldUnit,
      indirect_cost: Math.max(0, Number(indirectCost) || 0),
      notes,
      items,
      syncProductPricing,
      targetSalePrice: Number(targetSalePrice) || 0,
    });

    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <UtensilsCrossed size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {editing ? `Editar Receta: ${editing.recipe.name}` : "Nueva Receta / Producto Elaborado"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cargá los insumos por tanda; el sistema calcula el gasto y costo por cada unidad
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </header>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {formError && (
              <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Columna Izquierda: Producto final + Rendimiento + Insumos */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Producto terminado */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      1. Artículo Elaborado (se suma al stock)
                    </span>
                    {!editing && (
                      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-0.5 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setProductMode("new")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            productMode === "new"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          Crear nuevo
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductMode("existing")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            productMode === "existing"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          Ya existente
                        </button>
                      </div>
                    )}
                  </div>

                  {productMode === "new" && !editing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Nombre del nuevo producto elaborado
                        </label>
                        <input
                          type="text"
                          value={newProdName}
                          onChange={(e) => {
                            setNewProdName(e.target.value);
                            setRecipeName(e.target.value);
                          }}
                          placeholder="Ej: Empanada de Carne / Pizza Muzzarella"
                          autoComplete="off"
                          data-lpignore="true"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                        />
                      </div>
                      <div className="relative">
                        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Categoría
                        </label>
                        <input
                          type="text"
                          value={newProdCategory}
                          onFocus={() => setIsCategoryOpen(true)}
                          onBlur={() => setTimeout(() => setIsCategoryOpen(false), 150)}
                          onChange={(e) => {
                            setNewProdCategory(e.target.value);
                            setIsCategoryOpen(true);
                          }}
                          placeholder="Seleccionar o escribir nueva categoría..."
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-lpignore="true"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                        />
                        {isCategoryOpen && (
                          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                            {newProdCategory.trim() &&
                              !categories.some(
                                (c) => c.toLowerCase() === newProdCategory.trim().toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setNewProdCategory(newProdCategory.trim());
                                    setIsCategoryOpen(false);
                                  }}
                                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Plus size={13} />
                                  Crear categoría: &ldquo;{newProdCategory.trim()}&rdquo;
                                </button>
                              )}
                            {filteredCategories.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setNewProdCategory(c);
                                  setIsCategoryOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <span>{c}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Se vende por
                        </label>
                        <select
                          value={newProdSaleMode}
                          onChange={(e) => {
                            const mode = e.target.value as "unit" | "weight";
                            setNewProdSaleMode(mode);
                            setYieldUnit(mode === "weight" ? "kg" : "unit");
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                        >
                          <option value="unit">Unidad (u.)</option>
                          <option value="weight">Peso (kg)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                          Producto terminado del catálogo
                        </label>
                        <select
                          value={selectedProductId}
                          onChange={(e) => handleSelectExistingProduct(e.target.value)}
                          disabled={Boolean(editing)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                        >
                          <option value="">Seleccioná un producto...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({currency.format(p.price)} • Stock: {p.stock_current})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Rendimiento por tanda */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        1 Tanda rinde
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={batchYield}
                        onChange={(e) => setBatchYield(e.target.value)}
                        autoComplete="off"
                        data-lpignore="true"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                      />
                      {yieldUnit === "unit" && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {[
                            { label: "½ doc.", val: 6 },
                            { label: "1 doc.", val: 12 },
                            { label: "2 doc.", val: 24 },
                            { label: "5 doc.", val: 60 },
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => setBatchYield(String(preset.val))}
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold border transition cursor-pointer ${
                                Number(batchYield) === preset.val
                                  ? "border-blue-500 bg-blue-600 text-white"
                                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Unidad de rinde
                      </label>
                      <select
                        value={yieldUnit}
                        onChange={(e) => setYieldUnit(e.target.value as RecipeYieldUnit)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                      >
                        <option value="unit">Unidades (u.)</option>
                        <option value="kg">Kilogramos (kg)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Costo extra tanda ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={indirectCost}
                        onChange={(e) => setIndirectCost(e.target.value)}
                        placeholder="Ej: caja/gas"
                        autoComplete="off"
                        data-lpignore="true"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Buscador y lista de insumos */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    2. Insumos / Materia Prima que gasta 1 Tanda
                  </label>

                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      placeholder="Buscar insumo del inventario (ej: Harina, Muzzarella, Tapas)..."
                      autoComplete="off"
                      data-lpignore="true"
                      className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                    />

                    {filteredIngredients.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredIngredients.map((ing) => (
                          <button
                            key={ing.id}
                            type="button"
                            onClick={() => handleAddIngredient(ing)}
                            className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {ing.name}
                                </p>
                                {recipeProductIdsSet?.has(ing.id) && (
                                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shrink-0">
                                    Sub-receta
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                Stock: {ing.stock_current} {ing.sale_mode === "weight" ? "kg" : "u."} • Costo:{" "}
                                {currency.format(ing.cost_price)}/{ing.sale_mode === "weight" ? "kg" : "u."}
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[11px] font-bold text-white shrink-0">
                              <Plus size={12} />
                              Agregar
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de insumos agregados */}
                  <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:divide-slate-800">
                    {items.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                        Todavía no agregaste insumos. Buscá materia prima arriba para armar la receta.
                      </div>
                    ) : (
                      items.map((item) => {
                        const ing = productsById.get(item.ingredient_product_id);
                        if (!ing) return null;
                        const stockQtyBatch = convertInputToStockQuantity(
                          item.quantity_per_batch,
                          item.input_unit,
                          ing.sale_mode
                        );
                        const perUnitQty = Number((item.quantity_per_batch / safeYield).toFixed(3));
                        const lineCost = Number((stockQtyBatch * (Number(ing.cost_price) || 0)).toFixed(2));
                        const perUnitCost = Number((lineCost / safeYield).toFixed(2));
                        const ingBaseUnit = ing.sale_mode === "weight" ? "kg" : "u.";
                        const hasZeroCost = (Number(ing.cost_price) || 0) <= 0;

                        return (
                          <div
                            key={item.ingredient_product_id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {ing.name}
                                </p>
                                {hasZeroCost && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                    Sin costo ($0)
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                Base: {currency.format(ing.cost_price)}/{ingBaseUnit} • Por 1 {unitLabel}:{" "}
                                <strong className="text-slate-700 dark:text-slate-200">
                                  {perUnitQty} {item.input_unit === "unit" ? "u." : item.input_unit}
                                </strong>{" "}
                                ({currency.format(perUnitCost)}) • Tanda:{" "}
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {currency.format(lineCost)}
                                </strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                step="any"
                                min="0.0001"
                                value={item.quantity_per_batch}
                                onChange={(e) =>
                                  updateItem(item.ingredient_product_id, {
                                    quantity_per_batch: parseFloat(e.target.value) || 0,
                                  })
                                }
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              />
                              <select
                                value={item.input_unit}
                                onChange={(e) =>
                                  updateItem(item.ingredient_product_id, {
                                    input_unit: e.target.value as RecipeInputUnit,
                                  })
                                }
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {ing.sale_mode === "weight" ? (
                                  <>
                                    <option value="g">g</option>
                                    <option value="kg">kg</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="unit">u.</option>
                                    <option value="g">g</option>
                                  </>
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeItem(item.ingredient_product_id)}
                                className="!rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition cursor-pointer"
                                title="Quitar insumo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Resumen Financiero y Precio */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Costos y Rentabilidad
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    <Sparkles size={11} />
                    Cálculo en vivo
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Costo insumos (1 tanda):</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {currency.format(financials.ingredientsCostPerBatch)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Costo total (1 tanda):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {currency.format(financials.totalCostPerBatch)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Costo por 1 {unitLabel}:
                    </span>
                    <span className="font-mono text-base font-bold text-blue-600 dark:text-blue-400">
                      {currency.format(financials.unitCost)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Precio de venta en POS (por 1 {unitLabel})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={targetSalePrice}
                    onChange={(e) => setTargetSalePrice(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                  />
                  {/* Botones rápidos de margen sugerido */}
                  {financials.unitCost > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[30, 50, 80, 100].map((pct) => {
                        const suggested = Math.ceil(financials.unitCost * (1 + pct / 100));
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setTargetSalePrice(String(suggested))}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            +{pct}% ({currency.format(suggested)})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Ganancia Neta */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Ganancia por 1 {unitLabel}:
                    </span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        financials.unitProfit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {financials.unitProfit >= 0 ? "+" : ""}
                      {currency.format(financials.unitProfit)} ({financials.marginPercent}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Ingreso venta tanda ({safeYield} {unitLabel}):
                    </span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {currency.format(batchSaleTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Ganancia por 1 tanda ({safeYield} {unitLabel}):
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        batchProfit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {batchProfit >= 0 ? "+" : ""}
                      {currency.format(batchProfit)}
                    </span>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncProductPricing}
                    onChange={(e) => setSyncProductPricing(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-blue-600"
                  />
                  <span>
                    Actualizar automáticamente el <strong>costo y precio de venta</strong> del producto en el catálogo
                  </span>
                </label>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Notas de elaboración <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Hornear 12 min a 220°C"
                    autoComplete="off"
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? "Guardando..." : editing ? "Guardar Cambios" : "Guardar Receta"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
