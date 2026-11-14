import { useState } from "react";
import { LoadingState } from "@/components/ui/UiStates";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PriceListDetailPanel } from "@/modules/listas-precios/components/PriceListDetailPanel";
import { PriceListForm } from "@/modules/listas-precios/components/PriceListForm";
import { PriceListsTable } from "@/modules/listas-precios/components/PriceListsTable";
import { PriceListsToolbar } from "@/modules/listas-precios/components/PriceListsToolbar";
import { usePriceListsModule } from "@/modules/listas-precios/hooks/usePriceListsModule";
import type { PriceList } from "@/types/entities";
import type { PriceListFormValues } from "@/modules/listas-precios/schemas/price-list-form.schema";

export const ListasPreciosPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPriceLists = canRead("listas_precios");
  const canWritePriceLists = canWrite("listas_precios");

  const {
    priceLists,
    products,
    selectedPriceList,
    selectedPriceListId,
    setSelectedPriceListId,
    itemByProductId,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createPriceList,
    updatePriceList,
    deletePriceList,
    togglePriceListActive,
    setProductFixedPrice,
    removeProductFixedPrice,
  } = usePriceListsModule(tenantId, user?.id ?? null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedForEdit, setSelectedForEdit] = useState<PriceList | undefined>(undefined);

  const handleCreateClick = () => {
    if (!canWritePriceLists) return;
    clearFeedback();
    setFormMode("create");
    setSelectedForEdit(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (priceList: PriceList) => {
    if (!canWritePriceLists) return;
    clearFeedback();
    setFormMode("edit");
    setSelectedForEdit(priceList);
    setFormOpen(true);
  };

  const handleDeleteClick = async (priceList: PriceList) => {
    if (!canWritePriceLists) return;

    const confirmed = window.confirm(`¿Eliminar lista ${priceList.name}?`);
    if (!confirmed) return;

    await deletePriceList(priceList.id);
  };

  const handleSubmitForm = async (values: PriceListFormValues) => {
    if (formMode === "create") {
      await createPriceList(values);
    } else if (selectedForEdit) {
      await updatePriceList(selectedForEdit.id, values);
    }

    setFormOpen(false);
    setSelectedForEdit(undefined);
  };

  if (!tenantId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay un comercio activo.
      </div>
    );
  }

  if (!canReadPriceLists) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No tenés permisos de lectura para este módulo.
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full">
      <PriceListsToolbar
        canWrite={canWritePriceLists}
        loading={isLoading || isSubmitting}
        search={search}
        onSearchChange={setSearch}
        onCreate={handleCreateClick}
        onReload={() => void reload()}
      />

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState
          message="Cargando listas de precios..."
          description="Sincronizando listas, márgenes de ganancia y reglas de precio..."
        />
      ) : (
        <PriceListsTable
          priceLists={priceLists}
          selectedPriceListId={selectedPriceListId}
          canWrite={canWritePriceLists}
          onSelect={(priceList) => setSelectedPriceListId(priceList.id)}
          onEdit={handleEditClick}
          onDelete={handleDeleteClick}
          onToggleActive={(priceList) => {
            void togglePriceListActive(priceList.id);
          }}
        />
      )}

      {selectedPriceList ? (
        <PriceListDetailPanel
          priceList={selectedPriceList}
          products={products}
          itemByProductId={itemByProductId}
          canWrite={canWritePriceLists}
          disabled={isSubmitting}
          onSetFixedPrice={setProductFixedPrice}
          onRemoveFixedPrice={removeProductFixedPrice}
        />
      ) : null}

      {formOpen ? (
        <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {formMode === "create" ? "Crear lista de precios" : "Editar lista de precios"}
          </h3>

          <PriceListForm
            mode={formMode}
            priceList={selectedForEdit}
            disabled={isSubmitting}
            onCancel={() => {
              setFormOpen(false);
              setSelectedForEdit(undefined);
            }}
            onSubmit={handleSubmitForm}
          />
        </section>
      ) : null}
    </div>
  );
};

