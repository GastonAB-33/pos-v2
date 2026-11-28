import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { productsService } from "@/services/products.service";
import { stockService, type CreateStockMovementInput } from "@/services/stock.service";
import type {
  Product,
  ProductionIngredientSnapshot,
  ProductionInputMode,
  ProductionOrder,
  Recipe,
  RecipeInputUnit,
  RecipeItem,
} from "@/types/entities";

const recipesCrud = new TenantCrudService<Recipe>(dbTables.recipes);
const recipeItemsCrud = new TenantCrudService<RecipeItem>(dbTables.recipe_items);
const productionOrdersCrud = new TenantCrudService<ProductionOrder>(dbTables.production_orders);

export type CreateRecipeInput = CreateEntityInput<Recipe>;
export type UpdateRecipeInput = UpdateEntityInput<Recipe>;

export interface RecipeItemDraft {
  ingredient_product_id: string;
  quantity_per_batch: number;
  input_unit: RecipeInputUnit;
}

export interface SaveRecipePayload {
  id?: string;
  product_id: string;
  name: string;
  batch_yield: number;
  yield_unit: "unit" | "kg";
  indirect_cost: number;
  notes?: string | null;
  is_active?: boolean;
  items: RecipeItemDraft[];
  syncProductPricing?: boolean;
  targetSalePrice?: number;
}

export interface RecipeFinancialSummary {
  ingredientsCostPerBatch: number;
  totalCostPerBatch: number;
  unitCost: number;
  salePrice: number;
  unitProfit: number;
  marginPercent: number;
  maxProducibleUnits: number | null;
  limitingIngredientName: string | null;
}

export interface ExecuteProductionPayload {
  recipe: Recipe;
  items: RecipeItem[];
  finishedProduct: Product;
  productsById: Map<string, Product>;
  inputMode: ProductionInputMode;
  amount: number;
  wasteUnits?: number;
  notes?: string;
  userId?: string | null;
}

const round3 = (n: number): number => Number(n.toFixed(3));
const round4 = (n: number): number => Number(n.toFixed(4));
const round2 = (n: number): number => Number(n.toFixed(2));

/**
 * Convierte la cantidad cargada en la receta (ej. 350 g) a la unidad base
 * en la que se almacena el stock del producto insumo (ej. 0.350 kg).
 */
export const convertInputToStockQuantity = (
  quantity: number,
  inputUnit: RecipeInputUnit,
  ingredientSaleMode: Product["sale_mode"]
): number => {
  if (ingredientSaleMode === "weight") {
    if (inputUnit === "g") return round4(quantity / 1000);
    return round4(quantity);
  }
  // Si el insumo se controla por unidad, se descuenta 1:1 (o en gramos si excepcionalmente usaron g)
  if (inputUnit === "g") return round4(quantity / 1000);
  return round4(quantity);
};

/**
 * Calcula costos de tanda, costo por unidad, ganancia y máximo producible
 * con el inventario actual de insumos.
 */
export const calculateRecipeFinancials = (
  recipe: Pick<Recipe, "batch_yield" | "indirect_cost">,
  items: Array<Pick<RecipeItem, "ingredient_product_id" | "quantity_per_batch" | "input_unit">>,
  finishedProduct: Product | undefined,
  productsById: Map<string, Product>
): RecipeFinancialSummary => {
  const safeYield = Math.max(0.001, Number(recipe.batch_yield) || 1);
  let ingredientsCostPerBatch = 0;
  let maxProducibleUnits: number | null = null;
  let limitingIngredientName: string | null = null;

  for (const item of items) {
    const ing = productsById.get(item.ingredient_product_id);
    if (!ing) continue;

    const stockQtyPerBatch = convertInputToStockQuantity(
      Number(item.quantity_per_batch) || 0,
      item.input_unit,
      ing.sale_mode
    );
    const ingCost = Number(ing.cost_price) || 0;
    ingredientsCostPerBatch += stockQtyPerBatch * ingCost;

    if (stockQtyPerBatch > 0) {
      const currentStock = Math.max(0, Number(ing.stock_current) || 0);
      const batchesPossible = currentStock / stockQtyPerBatch;
      const unitsPossible = Math.floor(batchesPossible * safeYield * 1000) / 1000;
      if (maxProducibleUnits === null || unitsPossible < maxProducibleUnits) {
        maxProducibleUnits = Math.max(0, round3(unitsPossible));
        limitingIngredientName = ing.name;
      }
    }
  }

  const indirect = Math.max(0, Number(recipe.indirect_cost) || 0);
  const totalCostPerBatch = round2(ingredientsCostPerBatch + indirect);
  const unitCost = round2(totalCostPerBatch / safeYield);
  const salePrice = Number(finishedProduct?.price) || 0;
  const unitProfit = round2(salePrice - unitCost);
  const marginPercent =
    salePrice > 0 ? round2((unitProfit / salePrice) * 100) : 0;

  return {
    ingredientsCostPerBatch: round2(ingredientsCostPerBatch),
    totalCostPerBatch,
    unitCost,
    salePrice,
    unitProfit,
    marginPercent,
    maxProducibleUnits,
    limitingIngredientName,
  };
};

export const productionService = {
  getRecipesByTenant: (tenantId: string) =>
    recipesCrud.query(tenantId, { order: { column: "name", ascending: true } }),

  getRecipeItemsByTenant: (tenantId: string) =>
    recipeItemsCrud.getAllByTenant(tenantId),

  getOrdersByTenant: (tenantId: string, limit = 150) =>
    productionOrdersCrud.query(tenantId, {
      order: { column: "created_at", ascending: false },
      limit,
    }),

  async saveRecipeWithItems(
    tenantId: string,
    payload: SaveRecipePayload,
    productsById: Map<string, Product>
  ): Promise<{ recipe: Recipe; items: RecipeItem[] }> {
    const cleanItems = payload.items.filter(
      (i) => i.ingredient_product_id && Number(i.quantity_per_batch) > 0
    );

    const recipeData: CreateRecipeInput = {
      product_id: payload.product_id,
      name: payload.name.trim(),
      batch_yield: Math.max(0.001, Number(payload.batch_yield) || 1),
      yield_unit: payload.yield_unit,
      indirect_cost: Math.max(0, Number(payload.indirect_cost) || 0),
      notes: payload.notes?.trim() || null,
      is_active: payload.is_active ?? true,
    };

    let savedRecipe: Recipe;
    if (payload.id) {
      const updatedRecipe = await recipesCrud.update(tenantId, payload.id, recipeData);
      if (!updatedRecipe) {
        throw new Error("No se encontró la receta a actualizar");
      }
      savedRecipe = updatedRecipe;
      const existingItems = await recipeItemsCrud.query(tenantId, {
        eq: { recipe_id: payload.id },
      });
      await Promise.all(
        existingItems.map((oldItem) => recipeItemsCrud.delete(tenantId, oldItem.id))
      );
    } else {
      savedRecipe = await recipesCrud.create(tenantId, recipeData);
    }

    const itemInputs = cleanItems.map((item) => ({
      recipe_id: savedRecipe.id,
      ingredient_product_id: item.ingredient_product_id,
      quantity_per_batch: round4(Number(item.quantity_per_batch)),
      input_unit: item.input_unit,
    }));

    const savedItems = itemInputs.length
      ? await recipeItemsCrud.createMany(tenantId, itemInputs)
      : [];

    if (payload.syncProductPricing) {
      const finishedProduct = productsById.get(payload.product_id);
      const summary = calculateRecipeFinancials(
        savedRecipe,
        cleanItems,
        finishedProduct,
        productsById
      );
      const nextPrice =
        payload.targetSalePrice !== undefined && payload.targetSalePrice >= 0
          ? round2(payload.targetSalePrice)
          : finishedProduct?.price ?? 0;
      const profitPercent =
        summary.unitCost > 0
          ? round2(((nextPrice - summary.unitCost) / summary.unitCost) * 100)
          : 0;

      await productsService.update(tenantId, payload.product_id, {
        cost_price: summary.unitCost,
        price: nextPrice,
        profit_percent: profitPercent,
      });
    }

    return { recipe: savedRecipe, items: savedItems };
  },

  async deleteRecipe(tenantId: string, recipeId: string): Promise<void> {
    const items = await recipeItemsCrud.query(tenantId, {
      eq: { recipe_id: recipeId },
    });
    await Promise.all(items.map((item) => recipeItemsCrud.delete(tenantId, item.id)));
    await recipesCrud.delete(tenantId, recipeId);
  },

  /**
   * Ejecuta un lote de producción (por unidades o por tandas):
   * 1. Calcula el factor proporcional respecto a la tanda base.
   * 2. Registra la orden en `production_orders`.
   * 3. Descuenta insumos de `products` y registra movimientos `"out"`.
   * 4. Suma unidades producidas al producto terminado y registra movimiento `"in"`.
   */
  async executeProductionOrder(
    tenantId: string,
    payload: ExecuteProductionPayload
  ): Promise<ProductionOrder> {
    const {
      recipe,
      items,
      finishedProduct,
      productsById,
      inputMode,
      amount,
      wasteUnits = 0,
      notes,
      userId,
    } = payload;

    const safeYield = Math.max(0.001, Number(recipe.batch_yield) || 1);
    const safeAmount = Math.max(0.001, Number(amount) || 0);
    const safeWaste = Math.max(0, Number(wasteUnits) || 0);

    let batchesCount: number;
    let unitsProduced: number;

    if (inputMode === "batches") {
      batchesCount = round4(safeAmount);
      const grossUnits = safeAmount * safeYield;
      unitsProduced = Math.max(0.001, round3(grossUnits - safeWaste));
    } else {
      unitsProduced = round3(safeAmount);
      batchesCount = round4((safeAmount + safeWaste) / safeYield);
    }

    const snapshots: ProductionIngredientSnapshot[] = [];
    let ingredientsCost = 0;

    for (const item of items) {
      const ing = productsById.get(item.ingredient_product_id);
      if (!ing) continue;

      const qtyUsedInInputUnit = round4(Number(item.quantity_per_batch) * batchesCount);
      const stockDeducted = convertInputToStockQuantity(
        qtyUsedInInputUnit,
        item.input_unit,
        ing.sale_mode
      );
      const unitCost = Number(ing.cost_price) || 0;
      const lineCost = round2(stockDeducted * unitCost);
      ingredientsCost += lineCost;

      snapshots.push({
        ingredient_product_id: ing.id,
        ingredient_name: ing.name,
        input_unit: item.input_unit,
        quantity_used: qtyUsedInInputUnit,
        stock_deducted: stockDeducted,
        unit_cost: unitCost,
        total_cost: lineCost,
      });
    }

    const indirectTotal = round2((Number(recipe.indirect_cost) || 0) * batchesCount);
    const totalCost = round2(ingredientsCost + indirectTotal);
    const unitCost = round2(totalCost / unitsProduced);
    const estimatedSaleTotal = round2(unitsProduced * (Number(finishedProduct.price) || 0));
    const estimatedProfit = round2(estimatedSaleTotal - totalCost);

    const order = await productionOrdersCrud.create(tenantId, {
      recipe_id: recipe.id,
      product_id: finishedProduct.id,
      product_name_snapshot: finishedProduct.name,
      input_mode: inputMode,
      batches_count: batchesCount,
      units_produced: unitsProduced,
      waste_units: safeWaste,
      total_cost: totalCost,
      unit_cost: unitCost,
      estimated_sale_total: estimatedSaleTotal,
      estimated_profit: estimatedProfit,
      status: "completed",
      ingredients_snapshot: snapshots,
      notes: notes?.trim() || null,
      created_by: userId ?? null,
    });

    const movementNotesOut = `Consumo producción: ${finishedProduct.name} (${unitsProduced} ${recipe.yield_unit === "kg" ? "kg" : "u."})`;
    const movementNotesIn = `Alta por producción: ${unitsProduced} ${recipe.yield_unit === "kg" ? "kg" : "u."} (${round2(batchesCount)} tanda/s)`;

    const stockMovementInputs: CreateStockMovementInput[] = snapshots
      .filter((s) => s.stock_deducted > 0)
      .map((s) => ({
        product_id: s.ingredient_product_id,
        movement_type: "out" as const,
        quantity: s.stock_deducted,
        reference_type: "production",
        reference_id: order.id,
        notes: movementNotesOut,
        created_by: userId ?? null,
      }));

    // Descontar insumos
    await Promise.all(
      snapshots.map(async (s) => {
        if (s.stock_deducted <= 0) return;
        const ing = productsById.get(s.ingredient_product_id);
        if (!ing) return;
        const nextStock = round3(Math.max(0, (Number(ing.stock_current) || 0) - s.stock_deducted));
        await productsService.update(tenantId, ing.id, { stock_current: nextStock });
      })
    );

    // Sumar producto terminado y actualizar su último costo unitario
    const nextFinishedStock = round3((Number(finishedProduct.stock_current) || 0) + unitsProduced);
    const nextProfitPercent =
      unitCost > 0
        ? round2((((Number(finishedProduct.price) || 0) - unitCost) / unitCost) * 100)
        : finishedProduct.profit_percent ?? 0;

    await productsService.update(tenantId, finishedProduct.id, {
      stock_current: nextFinishedStock,
      cost_price: unitCost,
      profit_percent: nextProfitPercent,
    });

    stockMovementInputs.push({
      product_id: finishedProduct.id,
      movement_type: "in" as const,
      quantity: unitsProduced,
      reference_type: "production",
      reference_id: order.id,
      notes: movementNotesIn,
      created_by: userId ?? null,
    });

    await stockService.createMany(tenantId, stockMovementInputs);

    return order;
  },

  /**
   * Anula una orden de producción completada: revierte el stock de insumos
   * y descuenta las unidades del producto terminado.
   */
  async cancelProductionOrder(
    tenantId: string,
    order: ProductionOrder,
    productsById: Map<string, Product>,
    userId?: string | null
  ): Promise<ProductionOrder> {
    if (order.status === "cancelled") return order;

    const updated =
      (await productionOrdersCrud.update(tenantId, order.id, {
        status: "cancelled",
      })) ?? { ...order, status: "cancelled" as const };

    const movements = [];

    for (const snap of order.ingredients_snapshot ?? []) {
      if (snap.stock_deducted <= 0) continue;
      const ing = productsById.get(snap.ingredient_product_id);
      if (ing) {
        const restored = round3((Number(ing.stock_current) || 0) + snap.stock_deducted);
        await productsService.update(tenantId, ing.id, { stock_current: restored });
      }
      movements.push({
        product_id: snap.ingredient_product_id,
        movement_type: "in" as const,
        quantity: snap.stock_deducted,
        reference_type: "production_reversal",
        reference_id: order.id,
        notes: `Reversión por anulación de producción: ${order.product_name_snapshot}`,
        created_by: userId ?? null,
      });
    }

    const finished = productsById.get(order.product_id);
    if (finished && order.units_produced > 0) {
      const reverted = round3(Math.max(0, (Number(finished.stock_current) || 0) - order.units_produced));
      await productsService.update(tenantId, finished.id, { stock_current: reverted });
      movements.push({
        product_id: order.product_id,
        movement_type: "out" as const,
        quantity: order.units_produced,
        reference_type: "production_reversal",
        reference_id: order.id,
        notes: `Anulación alta de producción: ${order.product_name_snapshot}`,
        created_by: userId ?? null,
      });
    }

    if (movements.length) {
      await stockService.createMany(tenantId, movements);
    }

    return updated;
  },
};
