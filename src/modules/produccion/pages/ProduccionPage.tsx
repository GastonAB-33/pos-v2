import { useMemo, useState } from "react";
import {
  ChefHat,
  Flame,
  History,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { ProduceOrderModal } from "@/modules/produccion/components/ProduceOrderModal";
import { RecipeFormModal } from "@/modules/produccion/components/RecipeFormModal";
import {
  useProductionModule,
  type EnrichedRecipe,
} from "@/modules/produccion/hooks/useProductionModule";
import type { ProductionOrder } from "@/types/entities";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const ProduccionPage = () => {
  const toast = useToast();
  const { canWrite } = usePermissions();
  const canWriteProduction = canWrite("produccion");

  const {
    products,
    productsById,
    recipeProductIdsSet,
    categories,
    enrichedRecipes,
    orders,
    isLoading,
    isMutating,
    error,
    setError,
    loadData,
    createFinishedProduct,
    saveRecipe,
    deleteRecipe,
    produceOrder,
    cancelOrder,
  } = useProductionModule();

  const [activeTab, setActiveTab] = useState<"recipes" | "history">("recipes");
  const [search, setSearch] = useState("");
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<EnrichedRecipe | null>(null);
  const [produceTarget, setProduceTarget] = useState<EnrichedRecipe | null>(null);

  const filteredRecipes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return enrichedRecipes;
    return enrichedRecipes.filter(
      (r) =>
        r.recipe.name.toLowerCase().includes(term) ||
        (r.finishedProduct?.name ?? "").toLowerCase().includes(term) ||
        (r.finishedProduct?.category ?? "").toLowerCase().includes(term)
    );
  }, [enrichedRecipes, search]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter(
      (o) =>
        o.product_name_snapshot.toLowerCase().includes(term) ||
        (o.notes ?? "").toLowerCase().includes(term)
    );
  }, [orders, search]);

  const kpis = useMemo(() => {
    const completedToday = orders.filter((o) => {
      if (o.status !== "completed") return false;
      const d = new Date(o.created_at);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
    const todayUnits = completedToday.reduce((s, o) => s + Number(o.units_produced || 0), 0);
    const todayProfit = completedToday.reduce((s, o) => s + Number(o.estimated_profit || 0), 0);
    const totalSoldUnits = enrichedRecipes.reduce((s, r) => s + r.salesStats.soldUnits, 0);
    const totalSoldProfit = enrichedRecipes.reduce((s, r) => s + r.salesStats.soldProfit, 0);
    return {
      totalRecipes: enrichedRecipes.length,
      todayLots: completedToday.length,
      todayUnits: Number(todayUnits.toFixed(2)),
      todayProfit,
      totalSoldUnits: Number(totalSoldUnits.toFixed(2)),
      totalSoldProfit,
    };
  }, [enrichedRecipes, orders]);

  const handleConfirmProduce = async (params: {
    enriched: EnrichedRecipe;
    inputMode: "units" | "batches";
    amount: number;
    wasteUnits?: number;
    notes?: string;
  }) => {
    const created = await produceOrder(params);
    if (created) {
      toast.success(
        `Producción registrada: +${created.units_produced} ${
          params.enriched.recipe.yield_unit === "kg" ? "kg" : "u."
        } de "${created.product_name_snapshot}"`
      );
      setProduceTarget(null);
    }
  };

  const handleCancelOrder = async (order: ProductionOrder) => {
    const confirmed = window.confirm(
      `¿Anular el lote de "${order.product_name_snapshot}" (${order.units_produced} u.)? Se devolverán los insumos al inventario y se descontará el producto terminado.`
    );
    if (!confirmed) return;
    const ok = await cancelOrder(order);
    if (ok) toast.success("Lote anulado y stock revertido");
  };

  const handleDeleteRecipe = async (enriched: EnrichedRecipe) => {
    const confirmed = window.confirm(
      `¿Eliminar la receta "${enriched.recipe.name}"? El producto seguirá existiendo en tu catálogo.`
    );
    if (!confirmed) return;
    const ok = await deleteRecipe(enriched.recipe.id);
    if (ok) toast.success("Receta eliminada");
  };

  if (isLoading) {
    return <LoadingState message="Cargando recetas y órdenes de producción..." />;
  }

  return (
    <div className="space-y-5">
      {/* Header flotante limpio */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            INVENTARIO › PRODUCCIÓN
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Producción y Recetas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Elaborá alimentos o insumos por tanda o por unidad descontando materia prima del stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw size={15} />
            Actualizar
          </button>
          {canWriteProduction && (
            <button
              type="button"
              onClick={() => {
                setEditingRecipe(null);
                setRecipeModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
            >
              <Plus size={16} />
              Nueva Receta
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline cursor-pointer">
            Cerrar
          </button>
        </div>
      )}

      {/* KPIs compactos */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Recetas Activas
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {kpis.totalRecipes}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Lotes Hoy
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
            {kpis.todayLots}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Elaborado Hoy
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
            {kpis.todayUnits}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ganancia por Ventas
          </span>
          <p className="mt-1 text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
            {currency.format(kpis.totalSoldProfit)}
          </p>
          <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {kpis.totalSoldUnits} u. vendidas en POS
          </span>
        </div>
      </section>

      {/* Barra de búsqueda + Tabs integrados */}
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === "recipes"
                  ? "Buscar receta o producto elaborado..."
                  : "Buscar en historial de producción..."
              }
              autoComplete="off"
              data-lpignore="true"
              className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("recipes")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "recipes"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <ChefHat size={14} />
              Recetas ({enrichedRecipes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <History size={14} />
              Historial ({orders.length})
            </button>
          </div>
        </div>
      </section>

      {/* TAB 1: RECETAS */}
      {activeTab === "recipes" ? (
        filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <ChefHat size={34} className="text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {search ? "No hay recetas que coincidan con tu búsqueda" : "Aún no creaste ninguna receta"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              Creá tu primera receta indicando qué insumos lleva una tanda y cuántas unidades rinde.
              Después vas a poder producir por tanda o por unidad en segundos.
            </p>
            {canWriteProduction && !search && (
              <button
                type="button"
                onClick={() => {
                  setEditingRecipe(null);
                  setRecipeModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
              >
                <Plus size={15} />
                Crear primera receta
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tabla Desktop */}
            <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 dark:bg-slate-800/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Producto / Receta</th>
                    <th className="px-4 py-3">Rinde Tanda</th>
                    <th className="px-4 py-3 text-right">Costo Unit.</th>
                    <th className="px-4 py-3 text-right">Precio Venta</th>
                    <th className="px-4 py-3 text-right">Ganancia / u.</th>
                    <th className="px-4 py-3 text-right">Stock / Max.</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecipes.map((item) => {
                    const unitLabel = item.recipe.yield_unit === "kg" ? "kg" : "u.";
                    return (
                      <tr
                        key={item.recipe.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {item.recipe.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.items.length} insumo{item.items.length === 1 ? "" : "s"} •{" "}
                            {item.finishedProduct?.category ?? "Elaborados"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                          {item.recipe.batch_yield} {unitLabel}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {currency.format(item.financials.unitCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {currency.format(item.financials.salePrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold font-mono ${
                              item.financials.unitProfit >= 0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            <TrendingUp size={11} />
                            {currency.format(item.financials.unitProfit)} ({item.financials.marginPercent}%)
                          </span>
                          {item.salesStats.soldUnits > 0 && (
                            <span className="mt-1 block text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              Vendidas: {item.salesStats.soldUnits} {unitLabel} • Real:{" "}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {currency.format(item.salesStats.soldProfit)}
                              </strong>{" "}
                              ({currency.format(item.salesStats.profitPerSoldUnit)}/{unitLabel})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.finishedProduct?.stock_current ?? 0} {unitLabel}
                          </span>
                          {item.financials.maxProducibleUnits !== null && (
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                              Podés hacer: {item.financials.maxProducibleUnits} {unitLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {canWriteProduction && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setProduceTarget(item)}
                                  className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
                                >
                                  <Flame size={13} />
                                  Producir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRecipe(item);
                                    setRecipeModalOpen(true);
                                  }}
                                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Editar receta"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRecipe(item)}
                                  className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition cursor-pointer"
                                  title="Eliminar receta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards Mobile */}
            <div className="block md:hidden space-y-3">
              {filteredRecipes.map((item) => {
                const unitLabel = item.recipe.yield_unit === "kg" ? "kg" : "u.";
                return (
                  <div
                    key={item.recipe.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          1 tanda = {item.recipe.batch_yield} {unitLabel}
                        </span>
                        <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {item.recipe.name}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                          Precio
                        </span>
                        <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white">
                          {currency.format(item.financials.salePrice)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Costo</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {currency.format(item.financials.unitCost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Ganancia</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {currency.format(item.financials.unitProfit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Stock</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {item.finishedProduct?.stock_current ?? 0} {unitLabel}
                        </span>
                      </div>
                    </div>

                    {canWriteProduction && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setProduceTarget(item)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
                        >
                          <Flame size={14} />
                          Producir ahora
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRecipe(item);
                            setRecipeModalOpen(true);
                          }}
                          className="!rounded-full h-9 w-9 inline-flex items-center justify-center border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRecipe(item)}
                          className="!rounded-full h-9 w-9 inline-flex items-center justify-center border border-slate-200 text-rose-500 dark:border-slate-700 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )
      ) : /* TAB 2: HISTORIAL */ filteredOrders.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <History size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No hay lotes de producción registrados todavía
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 dark:bg-slate-800/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Producto Elaborado</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Costo Total</th>
                  <th className="px-4 py-3 text-right">Ganancia Est.</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {dateFormatter.format(new Date(order.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {order.product_name_snapshot}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {Number(order.batches_count.toFixed(2))} tanda/s •{" "}
                        {order.ingredients_snapshot?.length ?? 0} insumos descontados
                        {order.notes ? ` • ${order.notes}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                      +{order.units_produced}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 dark:text-slate-300">
                      {currency.format(order.total_cost)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {currency.format(order.estimated_profit)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          order.status === "completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {order.status === "completed" ? "Completado" : "Anulado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canWriteProduction && order.status === "completed" && (
                        <button
                          type="button"
                          onClick={() => void handleCancelOrder(order)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-rose-950/30 transition cursor-pointer"
                          title="Anular lote y revertir stock"
                        >
                          <RotateCcw size={12} />
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {dateFormatter.format(new Date(order.created_at))}
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white">
                      {order.product_name_snapshot}
                    </h4>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      order.status === "completed"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {order.status === "completed" ? "Completado" : "Anulado"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span>Cantidad: +{order.units_produced}</span>
                  <span>Costo: {currency.format(order.total_cost)}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{currency.format(order.estimated_profit)}
                  </span>
                </div>
                {canWriteProduction && order.status === "completed" && (
                  <button
                    type="button"
                    onClick={() => void handleCancelOrder(order)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 py-1.5 text-xs font-semibold text-rose-600 dark:border-rose-900/60 dark:text-rose-400 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    Anular lote y revertir stock
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modales */}
      <RecipeFormModal
        open={recipeModalOpen}
        editing={editingRecipe}
        products={products}
        productsById={productsById}
        recipeProductIdsSet={recipeProductIdsSet}
        categories={categories}
        isSubmitting={isMutating}
        onClose={() => {
          setRecipeModalOpen(false);
          setEditingRecipe(null);
        }}
        onCreateProduct={createFinishedProduct}
        onSave={async (payload) => {
          const ok = await saveRecipe(payload);
          if (ok) toast.success(editingRecipe ? "Receta actualizada" : "Receta guardada");
          return ok;
        }}
      />

      <ProduceOrderModal
        open={Boolean(produceTarget)}
        enriched={produceTarget}
        productsById={productsById}
        isSubmitting={isMutating}
        onClose={() => setProduceTarget(null)}
        onConfirm={handleConfirmProduce}
      />
    </div>
  );
};
