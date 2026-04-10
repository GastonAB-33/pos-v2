import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  generateFromSaleSchema,
  type GenerateFromSaleValues,
} from "@/modules/facturacion/schemas/facturacion.schemas";

interface SaleCandidate {
  sale: {
    id: string;
    sale_number: string;
    total: number;
    customer_id: string | null;
  };
  customerName: string;
  generatedDocuments: Array<{ document_type: string; document_number: string }>;
}

interface GenerateFromSaleFormProps {
  saleCandidates: SaleCandidate[];
  disabled?: boolean;
  onSubmit: (values: GenerateFromSaleValues) => Promise<void>;
  onCancel: () => void;
}

const defaultValues: GenerateFromSaleValues = {
  saleId: "",
  documentType: "B",
  notes: "",
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const GenerateFromSaleForm = ({
  saleCandidates,
  disabled,
  onSubmit,
  onCancel,
}: GenerateFromSaleFormProps) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GenerateFromSaleValues>({
    resolver: zodResolver(generateFromSaleSchema),
    defaultValues,
  });

  const selectedSaleId = watch("saleId");
  const selectedSale = saleCandidates.find((candidate) => candidate.sale.id === selectedSaleId) ?? null;
  const selectedSaleHasCustomer = Boolean(selectedSale?.sale.customer_id);

  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit(async (values) => {
        if (!selectedSaleHasCustomer && values.documentType !== "PRESUPUESTO") {
          return;
        }
        await onSubmit(values);
      })}
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Venta</label>
        <select {...register("saleId")} className="ui-input" disabled={disabled}>
          <option value="">Seleccionar venta</option>
          {saleCandidates.map((candidate) => (
            <option key={candidate.sale.id} value={candidate.sale.id}>
              {candidate.sale.sale_number} · {candidate.customerName} · {currency.format(candidate.sale.total)}
            </option>
          ))}
        </select>
        {errors.saleId ? <p className="mt-1 text-xs text-red-600">{errors.saleId.message}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de documento</label>
        <select {...register("documentType")} className="ui-input" disabled={disabled}>
          <option value="A" disabled={!selectedSaleHasCustomer}>
            Factura A
          </option>
          <option value="B" disabled={!selectedSaleHasCustomer}>
            Factura B
          </option>
          <option value="C" disabled={!selectedSaleHasCustomer}>
            Factura C
          </option>
          <option value="PRESUPUESTO">Presupuesto</option>
        </select>
        {!selectedSaleHasCustomer && selectedSaleId ? (
          <p className="mt-1 text-xs text-amber-700">
            Venta sin cliente: solo puede generar PRESUPUESTO.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
        <textarea rows={3} {...register("notes")} className="ui-input" disabled={disabled} />
      </div>

      {selectedSale ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p>Cliente: {selectedSale.customerName}</p>
          <p>Total venta: {currency.format(selectedSale.sale.total)}</p>
          <p>
            Documentos ya generados:{" "}
            {selectedSale.generatedDocuments.length
              ? selectedSale.generatedDocuments
                  .map((document) => `${document.document_type} ${document.document_number}`)
                  .join(" | ")
              : "Ninguno"}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="ui-btn-ghost" onClick={onCancel} disabled={disabled}>
          Cancelar
        </button>
        <button type="submit" className="ui-btn-primary" disabled={disabled}>
          Generar documento
        </button>
      </div>
    </form>
  );
};
