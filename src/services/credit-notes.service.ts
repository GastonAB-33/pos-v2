import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { CreditNote } from "@/types/entities";

const crud = new TenantCrudService<CreditNote>(dbTables.credit_notes);

export type CreateCreditNoteInput = CreateEntityInput<CreditNote>;
export type UpdateCreditNoteInput = UpdateEntityInput<CreditNote>;

const extractSequence = (documentNumber: string): number => {
  const tail = documentNumber.split("-").pop() ?? "";
  const parsed = Number.parseInt(tail, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const creditNotesService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateCreditNoteInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateCreditNoteInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  generateDocumentNumber: async (tenantId: string) => {
    const notes = await crud.getAllByTenant(tenantId);
    const maxSequence = notes.reduce(
      (max, note) => (extractSequence(note.document_number) > max ? extractSequence(note.document_number) : max),
      0
    );
    const next = maxSequence + 1;
    return `NC-${String(next).padStart(8, "0")}`;
  },
};
