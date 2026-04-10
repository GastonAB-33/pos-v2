import { useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { PromotionForm } from "@/modules/promociones/components/PromotionForm";
import { PromotionsTable } from "@/modules/promociones/components/PromotionsTable";
import { PromotionsToolbar } from "@/modules/promociones/components/PromotionsToolbar";
import { usePromotionsCrud } from "@/modules/promociones/hooks/usePromotionsCrud";
import type { Promotion } from "@/types/entities";
import type { PromotionFormValues } from "@/modules/promociones/schemas/promotion-form.schema";

export const PromocionesPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadPromociones = canRead("promociones");
  const canWritePromociones = canWrite("promociones");

  const {
    promotions,
    products,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionActive,
  } = usePromotionsCrud(tenantId, user?.id ?? null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | undefined>(undefined);

  const productNameById = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products]
  );

  const handleCreateClick = () => {
    if (!canWritePromociones) return;
    clearFeedback();
    setFormMode("create");
    setSelectedPromotion(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (promotion: Promotion) => {
    if (!canWritePromociones) return;
    clearFeedback();
    setFormMode("edit");
    setSelectedPromotion(promotion);
    setFormOpen(true);
  };

  const handleDeleteClick = async (promotion: Promotion) => {
    if (!canWritePromociones) return;

    const confirmed = window.confirm(`Eliminar promocion ${promotion.name}?`);
    if (!confirmed) return;

    await deletePromotion(promotion.id);
  };

  const handleToggleClick = async (promotion: Promotion) => {
    if (!canWritePromociones) return;
    await togglePromotionActive(promotion.id);
  };

  const handleSubmitForm = async (values: PromotionFormValues) => {
    if (formMode === "create") {
      await createPromotion(values);
    } else if (selectedPromotion) {
      await updatePromotion(selectedPromotion.id, values);
    }

    setFormOpen(false);
    setSelectedPromotion(undefined);
  };

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Promociones"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadPromociones) {
    return (
      <PagePlaceholder
        title="Promociones"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Promociones" description="Reglas automaticas aplicables en POS">
      <div className="space-y-4">
        <PromotionsToolbar
          canWrite={canWritePromociones}
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
          <div className="ui-loading">Cargando promociones...</div>
        ) : (
          <PromotionsTable
            promotions={promotions}
            productNameById={productNameById}
            canWrite={canWritePromociones}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onToggleActive={handleToggleClick}
          />
        )}

        {formOpen ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-4 text-base font-semibold text-slate-900">
              {formMode === "create" ? "Crear promocion" : "Editar promocion"}
            </h3>

            <PromotionForm
              mode={formMode}
              promotion={selectedPromotion}
              products={products}
              disabled={isSubmitting}
              onCancel={() => {
                setFormOpen(false);
                setSelectedPromotion(undefined);
              }}
              onSubmit={handleSubmitForm}
            />
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
