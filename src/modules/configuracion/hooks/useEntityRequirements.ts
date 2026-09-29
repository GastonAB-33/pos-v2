import { useEffect, useState } from "react";
import { settingsService } from "@/services/settings.service";
import type {
  CustomerRequiredFieldsSettings,
  EntityRequirementsSettings,
  SupplierRequiredFieldsSettings,
} from "@/types/entities";

export const DEFAULT_CUSTOMER_REQUIREMENTS: CustomerRequiredFieldsSettings = {
  document_number: true,
  phone: false,
  email: false,
  address: false,
};

export const DEFAULT_SUPPLIER_REQUIREMENTS: SupplierRequiredFieldsSettings = {
  tax_id: false,
  phone: false,
  email: false,
  address: false,
};

export const DEFAULT_ENTITY_REQUIREMENTS: EntityRequirementsSettings = {
  customer: DEFAULT_CUSTOMER_REQUIREMENTS,
  supplier: DEFAULT_SUPPLIER_REQUIREMENTS,
};

let cachedRequirements: { tenantId: string; data: EntityRequirementsSettings } | null = null;
const EVENT_NAME = "pos-entity-requirements-changed";

export const broadcastEntityRequirementsChanged = (
  tenantId: string,
  data: EntityRequirementsSettings
) => {
  cachedRequirements = { tenantId, data };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { tenantId, data } }));
  }
};

export const useEntityRequirements = (tenantId: string | null) => {
  const [requirements, setRequirements] = useState<EntityRequirementsSettings>(() => {
    if (tenantId && cachedRequirements?.tenantId === tenantId) {
      return cachedRequirements.data;
    }
    return DEFAULT_ENTITY_REQUIREMENTS;
  });
  const [isLoading, setIsLoading] = useState(
    Boolean(tenantId && (!cachedRequirements || cachedRequirements.tenantId !== tenantId))
  );

  useEffect(() => {
    if (!tenantId) {
      setRequirements(DEFAULT_ENTITY_REQUIREMENTS);
      setIsLoading(false);
      return;
    }

    let active = true;

    const onRequirementsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ tenantId: string; data: EntityRequirementsSettings }>;
      if (customEvent.detail?.tenantId === tenantId) {
        setRequirements(customEvent.detail.data);
      }
    };
    window.addEventListener(EVENT_NAME, onRequirementsChanged);

    void settingsService
      .getByTenant(tenantId)
      .then((settings) => {
        if (!active) return;
        const loaded = settings?.facturacion?.entity_requirements;
        const normalized: EntityRequirementsSettings = {
          customer: {
            document_number: loaded?.customer?.document_number ?? DEFAULT_CUSTOMER_REQUIREMENTS.document_number,
            phone: loaded?.customer?.phone ?? DEFAULT_CUSTOMER_REQUIREMENTS.phone,
            email: loaded?.customer?.email ?? DEFAULT_CUSTOMER_REQUIREMENTS.email,
            address: loaded?.customer?.address ?? DEFAULT_CUSTOMER_REQUIREMENTS.address,
          },
          supplier: {
            tax_id: loaded?.supplier?.tax_id ?? DEFAULT_SUPPLIER_REQUIREMENTS.tax_id,
            phone: loaded?.supplier?.phone ?? DEFAULT_SUPPLIER_REQUIREMENTS.phone,
            email: loaded?.supplier?.email ?? DEFAULT_SUPPLIER_REQUIREMENTS.email,
            address: loaded?.supplier?.address ?? DEFAULT_SUPPLIER_REQUIREMENTS.address,
          },
        };
        cachedRequirements = { tenantId, data: normalized };
        setRequirements(normalized);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener(EVENT_NAME, onRequirementsChanged);
    };
  }, [tenantId]);

  return {
    requirements,
    customerRequirements: requirements.customer,
    supplierRequirements: requirements.supplier,
    isLoading,
  };
};

export const formatCustomerDocument = (
  docType?: string | null,
  docNumber?: string | null
): string => {
  if (!docNumber || docNumber.startsWith("SD-") || docNumber.startsWith("S/D")) {
    return "Sin documento";
  }
  return `${(docType || "DNI").toUpperCase()} ${docNumber}`;
};

export const getEditableDocumentNumber = (docNumber?: string | null): string => {
  if (!docNumber || docNumber.startsWith("SD-") || docNumber.startsWith("S/D")) {
    return "";
  }
  return docNumber;
};
