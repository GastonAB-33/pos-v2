import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { arcaInvoicesService } from "@/services/arca/arca-invoices.service";
import { customersService } from "@/services/customers.service";
import { invoicesService } from "@/services/invoices.service";
import { salesService } from "@/services/sales.service";
import { settingsService } from "@/services/settings.service";
import type { ArcaInvoiceStatus, ArcaSettings, Customer, Invoice, InvoiceDocumentType, Sale } from "@/types/entities";
import type { BudgetFormValues, GenerateFromSaleValues } from "@/modules/facturacion/schemas/facturacion.schemas";

type FeedbackType = "success" | "error";

interface FacturacionFeedback {
  type: FeedbackType;
  message: string;
}

export type InvoiceStatusFilter = "all" | Invoice["status"];
export type InvoiceTypeFilter = "all" | Invoice["document_type"];

const roundAmount = (value: number): number => Number(value.toFixed(2));

const defaultArcaSettings: ArcaSettings = {
  enabled: false,
  mode: "mock",
  cuit_emisor: "",
  punto_venta: 1,
  certificado_alias: "",
  fiscal_environment: "homologacion",
  force_unavailable: false,
  allow_internal_fallback: true,
};

const isWithinDateRange = (rawDate: string, from: string, to: string): boolean => {
  const day = rawDate.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

export const useFacturacionModule = (tenantId: string | null, userId: string | null) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [arcaSettings, setArcaSettings] = useState<ArcaSettings>(defaultArcaSettings);
  const [typeFilter, setTypeFilter] = useState<InvoiceTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [arcaProcessingInvoiceId, setArcaProcessingInvoiceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FacturacionFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const load = useCallback(async () => {
    if (!tenantId) {
      setInvoices([]);
      setSales([]);
      setCustomers([]);
      setArcaSettings(defaultArcaSettings);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const [invoiceRows, saleRows, customerRows, tenantSettings] = await Promise.all([
        invoicesService.getAllByTenant(tenantId),
        salesService.getAllByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        settingsService.getByTenant(tenantId),
      ]);

      setInvoices(invoiceRows.sort((a, b) => b.issue_date.localeCompare(a.issue_date)));
      setSales(saleRows.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setCustomers(customerRows.sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setArcaSettings(tenantSettings.facturacion.arca);
    } catch {
      setFeedback({ type: "error", message: "No se pudo cargar facturacion" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const arcaOperationalStatus = useMemo(
    () =>
      arcaInvoicesService.getOperationalStatus({
        settings: arcaSettings,
      }),
    [arcaSettings]
  );

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const invoicesBySaleId = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const invoice of invoices) {
      if (!invoice.sale_id) continue;
      const current = map.get(invoice.sale_id) ?? [];
      current.push(invoice);
      map.set(invoice.sale_id, current);
    }
    return map;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => (typeFilter === "all" ? true : invoice.document_type === typeFilter))
      .filter((invoice) => (statusFilter === "all" ? true : invoice.status === statusFilter))
      .filter((invoice) => isWithinDateRange(invoice.issue_date, dateFrom, dateTo));
  }, [dateFrom, dateTo, invoices, statusFilter, typeFilter]);

  const upsertInvoiceInState = useCallback((nextInvoice: Invoice) => {
    setInvoices((current) => {
      const exists = current.some((invoice) => invoice.id === nextInvoice.id);
      if (!exists) {
        return [nextInvoice, ...current].sort((a, b) => b.issue_date.localeCompare(a.issue_date));
      }

      return current
        .map((invoice) => (invoice.id === nextInvoice.id ? nextInvoice : invoice))
        .sort((a, b) => b.issue_date.localeCompare(a.issue_date));
    });
  }, []);

  const createBudget = async (values: BudgetFormValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await invoicesService.createBudget(tenantId, {
        customer_id: values.customerId?.trim() ? values.customerId.trim() : null,
        subtotal: roundAmount(values.subtotal),
        tax_total: roundAmount(values.taxTotal),
        notes: values.notes?.trim() || null,
        status: "draft",
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "facturacion",
        action: "create_budget",
        entity_type: "invoice",
        entity_id: created.id,
        description: `Presupuesto creado: ${created.document_number}`,
        metadata: {
          document_type: created.document_type,
          customer_id: created.customer_id,
          total: created.total,
          status: created.status,
        },
      });

      setFeedback({ type: "success", message: "Presupuesto creado" });
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo crear presupuesto";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateFromSale = async (values: GenerateFromSaleValues) => {
    if (!tenantId) return;

    setIsSubmitting(true);
    try {
      const created = await invoicesService.createFromSale(tenantId, {
        sale_id: values.saleId,
        document_type: values.documentType as InvoiceDocumentType,
        notes: values.notes?.trim() || null,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "facturacion",
        action: "generate_from_sale",
        entity_type: "invoice",
        entity_id: created.id,
        description: `Documento fiscal generado: ${created.document_number}`,
        metadata: {
          sale_id: created.sale_id,
          document_type: created.document_type,
          total: created.total,
          arca_status: created.arca_status,
        },
      });

      setFeedback({ type: "success", message: "Documento fiscal generado" });
      await load();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo generar factura";
      setFeedback({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendInvoiceToArca = async (
    invoiceId: string,
    options?: { forcedStatus?: Extract<ArcaInvoiceStatus, "accepted" | "rejected"> }
  ): Promise<Invoice | null> => {
    if (!tenantId) return null;

    setArcaProcessingInvoiceId(invoiceId);
    setFeedback(null);

    try {
      const invoice = await invoicesService.getById(tenantId, invoiceId);
      if (!invoice) {
        throw new Error("Factura no encontrada");
      }

      if (!arcaOperationalStatus.available) {
        const reason = arcaOperationalStatus.reason ?? "ARCA no disponible";
        await auditService.createSafe(tenantId, {
          user_id: userId,
          module: "facturacion",
          action: "arca_send_blocked",
          entity_type: "invoice",
          entity_id: invoice.id,
          description: `Envio ARCA bloqueado para ${invoice.document_number}`,
          metadata: {
            mode: arcaOperationalStatus.mode,
            reason,
            arca_status: invoice.arca_status,
          },
        });
        throw new Error(reason);
      }

      if (invoice.document_type !== "PRESUPUESTO") {
        const customerValidation = arcaInvoicesService.validateCustomerTaxData(
          invoice.customer_snapshot
        );

        if (!customerValidation.valid) {
          const reason = customerValidation.errors.join(". ");
          await auditService.createSafe(tenantId, {
            user_id: userId,
            module: "facturacion",
            action: "arca_validation_error",
            entity_type: "invoice",
            entity_id: invoice.id,
            description: `Validacion fiscal fallida para ${invoice.document_number}`,
            metadata: {
              mode: arcaOperationalStatus.mode,
              errors: customerValidation.errors,
            },
          });
          throw new Error(reason);
        }
      }

      const pending = await invoicesService.updateArcaStatus(tenantId, invoice.id, {
        arca_status: "pending",
        arca_reference: invoice.arca_reference,
        arca_message: `Factura enviada a ARCA (${arcaOperationalStatus.mode}). Procesando...`,
      });
      upsertInvoiceInState(pending);

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "facturacion",
        action: "arca_send",
        entity_type: "invoice",
        entity_id: pending.id,
        description: `Envio a ARCA iniciado para ${pending.document_number}`,
        metadata: {
          previous_arca_status: invoice.arca_status,
          next_arca_status: "pending",
          arca_reference: pending.arca_reference,
          mode: arcaOperationalStatus.mode,
        },
      });

      const sendResult = await arcaInvoicesService.sendInvoice(pending, {
        forcedStatus: options?.forcedStatus,
        settings: arcaSettings,
      });
      const statusResult = await arcaInvoicesService.checkInvoiceStatus(
        sendResult.reference ?? `ARCA-MOCK-${Date.now()}`,
        {
          forcedStatus:
            options?.forcedStatus ??
            (sendResult.status === "accepted" || sendResult.status === "rejected"
              ? sendResult.status
              : undefined),
          settings: arcaSettings,
          tenantId,
        }
      );

      const finalStatus: ArcaInvoiceStatus =
        statusResult.status === "accepted" || statusResult.status === "rejected"
          ? statusResult.status
          : sendResult.status === "accepted" || sendResult.status === "rejected"
            ? sendResult.status
            : "pending";

      const finalMessage =
        finalStatus === "accepted"
          ? "Factura aprobada por ARCA"
          : finalStatus === "rejected"
            ? "Factura rechazada por ARCA"
            : "Factura enviada a ARCA. Estado pendiente";

      const updated = await invoicesService.updateArcaStatus(tenantId, pending.id, {
        arca_status: finalStatus,
        arca_reference: sendResult.reference,
        arca_message: finalMessage,
      });
      upsertInvoiceInState(updated);

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "facturacion",
        action: "arca_status_change",
        entity_type: "invoice",
        entity_id: updated.id,
        description: `Estado ARCA actualizado a ${updated.arca_status} para ${updated.document_number}`,
        metadata: {
          previous_arca_status: "pending",
          next_arca_status: updated.arca_status,
          arca_reference: updated.arca_reference,
          arca_response: sendResult.rawResponse,
          arca_status_check: statusResult.rawResponse,
          mode: arcaOperationalStatus.mode,
        },
      });

      setFeedback({
        type: finalStatus === "rejected" ? "error" : "success",
        message:
          finalStatus === "accepted"
            ? "Factura enviada y aprobada por ARCA"
            : finalStatus === "rejected"
              ? "Factura enviada y rechazada por ARCA"
              : "Factura enviada a ARCA. Pendiente de respuesta",
      });

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo enviar la factura a ARCA";
      setFeedback({ type: "error", message });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "facturacion",
        action: "arca_send_error",
        entity_type: "invoice",
        entity_id: invoiceId,
        description: `Error operativo en envio ARCA para factura ${invoiceId}`,
        metadata: {
          mode: arcaOperationalStatus.mode,
          error: message,
        },
      });
      return null;
    } finally {
      setArcaProcessingInvoiceId(null);
    }
  };

  const salesCandidates = useMemo(
    () =>
      sales.filter((sale) => sale.status === "completed").map((sale) => {
        const customerName = sale.customer_id
          ? customersById.get(sale.customer_id)?.full_name ?? "Cliente eliminado"
          : "Sin cliente";
        const generatedDocuments = invoicesBySaleId.get(sale.id) ?? [];
        return {
          sale,
          customerName,
          generatedDocuments,
        };
      }),
    [customersById, invoicesBySaleId, sales]
  );

  const summary = useMemo(() => {
    const issued = filteredInvoices.filter((invoice) => invoice.status === "issued");
    const issuedTotal = roundAmount(issued.reduce((acc, invoice) => acc + invoice.total, 0));

    return {
      totalDocuments: filteredInvoices.length,
      issuedDocuments: issued.length,
      issuedTotal,
      draftDocuments: filteredInvoices.filter((invoice) => invoice.status === "draft").length,
      rejectedArca: filteredInvoices.filter((invoice) => invoice.arca_status === "rejected").length,
    };
  }, [filteredInvoices]);

  return {
    invoices: filteredInvoices,
    allInvoices: invoices,
    customers,
    salesCandidates,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    isLoading,
    isSubmitting,
    arcaProcessingInvoiceId,
    feedback,
    clearFeedback,
    summary,
    arcaSettings,
    arcaOperationalStatus,
    reload: load,
    createBudget,
    generateFromSale,
    sendInvoiceToArca,
  };
};
