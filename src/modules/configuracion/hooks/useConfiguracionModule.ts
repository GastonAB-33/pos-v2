import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { customersService } from "@/services/customers.service";
import {
  settingsService,
  type TenantSettingsUpdateInput,
} from "@/services/settings.service";
import type {
  Customer,
  TenantSettings,
  TenantSettingsSectionKey,
} from "@/types/entities";

interface ConfigFeedback {
  type: "success" | "error";
  message: string;
}

const sectionLabel: Record<TenantSettingsSectionKey, string> = {
  negocio: "Negocio",
  pos: "POS",
  stock: "Stock",
  caja: "Caja",
  facturacion: "Facturacion",
  codigos_balanza: "Codigos de barras y balanza",
  apariencia: "Apariencia",
  sistema: "Sistema",
};

const sanitizeSectionAuditValues = (
  section: TenantSettingsSectionKey,
  values: TenantSettings[TenantSettingsSectionKey]
) => {
  if (section === "sistema") {
    const systemValues = values as TenantSettings["sistema"];

    return {
      ...systemValues,
      mercado_pago: {
        ...systemValues.mercado_pago,
        access_token: systemValues.mercado_pago.access_token ? "***" : "",
        public_key: systemValues.mercado_pago.public_key ? "***" : "",
      },
    } as TenantSettings[TenantSettingsSectionKey];
  }

  if (section === "facturacion") {
    const facturacionValues = values as TenantSettings["facturacion"];

    return {
      ...facturacionValues,
      arca: {
        ...facturacionValues.arca,
        certificado_alias: facturacionValues.arca.certificado_alias ? "***" : "",
      },
    } as TenantSettings[TenantSettingsSectionKey];
  }

  return values;
};

export const useConfiguracionModule = (
  tenantId: string | null,
  userId: string | null
) => {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [draft, setDraft] = useState<TenantSettings | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savingSection, setSavingSection] = useState<
    Record<TenantSettingsSectionKey, boolean>
  >({
    negocio: false,
    pos: false,
    stock: false,
    caja: false,
    facturacion: false,
    codigos_balanza: false,
    apariencia: false,
    sistema: false,
  });
  const [feedback, setFeedback] = useState<ConfigFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setSettings(null);
      setDraft(null);
      setCustomers([]);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const [resolvedSettings, customerRows] = await Promise.all([
        settingsService.getByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
      ]);

      setSettings(resolvedSettings);
      setDraft(resolvedSettings);
      setCustomers(
        customerRows
          .filter((customer) => customer.is_active)
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      );
    } catch {
      setFeedback({ type: "error", message: "No se pudo cargar la configuracion" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistWithAudit = useCallback(
    async (action: string, description: string, metadata: Record<string, unknown>) => {
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "configuracion",
        action,
        entity_type: "tenant_settings",
        entity_id: settings?.id ?? null,
        description,
        metadata,
      });
    },
    [settings?.id, tenantId, userId]
  );

  const saveSection = useCallback(
    async (section: TenantSettingsSectionKey) => {
      if (!tenantId || !draft) return;

      setSavingSection((prev) => ({ ...prev, [section]: true }));

      try {
        const patch = {
          [section]: draft[section],
        } as TenantSettingsUpdateInput;

        const updated = await settingsService.updateByTenant(tenantId, patch);
        setSettings(updated);
        setDraft(updated);
        setFeedback({
          type: "success",
          message: `Configuracion de ${sectionLabel[section]} guardada`,
        });

        await persistWithAudit(
          `update_${section}`,
          `Configuracion actualizada: ${sectionLabel[section]}`,
          {
            section,
            values: sanitizeSectionAuditValues(section, updated[section]),
          }
        );
      } catch {
        setFeedback({
          type: "error",
          message: `No se pudo guardar ${sectionLabel[section]}`,
        });
      } finally {
        setSavingSection((prev) => ({ ...prev, [section]: false }));
      }
    },
    [draft, persistWithAudit, tenantId]
  );

  const resetSection = useCallback(
    async (section: TenantSettingsSectionKey) => {
      if (!tenantId) return;

      setSavingSection((prev) => ({ ...prev, [section]: true }));

      try {
        const updated = await settingsService.resetSection(tenantId, section);
        setSettings(updated);
        setDraft(updated);
        setFeedback({
          type: "success",
          message: `Configuracion de ${sectionLabel[section]} restablecida`,
        });

        await persistWithAudit(
          `reset_${section}`,
          `Configuracion restablecida: ${sectionLabel[section]}`,
          {
            section,
          }
        );
      } catch {
        setFeedback({
          type: "error",
          message: `No se pudo restablecer ${sectionLabel[section]}`,
        });
      } finally {
        setSavingSection((prev) => ({ ...prev, [section]: false }));
      }
    },
    [persistWithAudit, tenantId]
  );

  const saveAll = useCallback(async () => {
    if (!tenantId || !draft) return;

    setIsSavingAll(true);
    try {
      const updated = await settingsService.updateByTenant(tenantId, {
        negocio: draft.negocio,
        pos: draft.pos,
        stock: draft.stock,
        caja: draft.caja,
        facturacion: draft.facturacion,
        codigos_balanza: draft.codigos_balanza,
        apariencia: draft.apariencia,
        sistema: draft.sistema,
      });

      setSettings(updated);
      setDraft(updated);
      setFeedback({ type: "success", message: "Configuracion general guardada" });

      await persistWithAudit("update_all", "Configuracion general actualizada", {
        sections: [
          "negocio",
          "pos",
          "stock",
          "caja",
          "facturacion",
          "codigos_balanza",
          "apariencia",
          "sistema",
        ],
      });
    } catch {
      setFeedback({
        type: "error",
        message: "No se pudo guardar la configuracion general",
      });
    } finally {
      setIsSavingAll(false);
    }
  }, [draft, persistWithAudit, tenantId]);

  return {
    settings,
    draft,
    setDraft,
    customers,
    isLoading,
    isSavingAll,
    savingSection,
    feedback,
    clearFeedback,
    reload: load,
    saveSection,
    resetSection,
    saveAll,
  };
};
