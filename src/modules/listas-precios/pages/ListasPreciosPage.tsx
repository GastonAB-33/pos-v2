import { useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
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

    const confirmed = window.confirm(`Eliminar lista ${priceList.name}?`);
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
      <PagePlaceholder
        title="Listas de precios"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadPriceLists) {
    return (
      <PagePlaceholder
        title="Listas de precios"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Listas de precios"
      description="Multiples listas por tenant, con modo porcentaje o precio fijo"
    >
      <div className="space-y-4">
        <PriceListsToolbar
          canWrite={canWritePriceLists}
          loading={isLoading || isSubmitting}
          search={search}
          onSearchChange={setSearch}
          onCreate={handleCreateClick}
          onReload={() => void reload()}
        />

        {feedback ? (
          <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
            {feedback.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="ui-loading">Cargando listas de precios...</div>
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
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
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
    </PagePlaceholder>
  );
};
