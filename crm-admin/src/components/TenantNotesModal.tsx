import React, { useState } from "react";
import { X, FileText, Calendar, Plus, MessageSquare } from "lucide-react";
import { TenantAccount } from "../types/crm.types";

interface TenantNotesModalProps {
  isOpen: boolean;
  tenant: TenantAccount | null;
  onClose: () => void;
  onSaveNotes: (tenantId: string, updatedNotes: string) => void;
}

export const TenantNotesModal: React.FC<TenantNotesModalProps> = ({
  isOpen,
  tenant,
  onClose,
  onSaveNotes,
}) => {
  const [notes, setNotes] = useState(tenant?.notes || "");
  const [newEntry, setNewEntry] = useState("");

  if (!isOpen || !tenant) return null;

  const handleAppendLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim()) return;

    const today = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedLog = `[${today}] ${newEntry.trim()}`;
    const nextNotes = notes.trim()
      ? `${formattedLog}\n\n${notes.trim()}`
      : formattedLog;

    setNotes(nextNotes);
    setNewEntry("");
    onSaveNotes(tenant.id, nextNotes);
  };

  const handleManualSave = () => {
    onSaveNotes(tenant.id, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Bitácora de Contacto</h3>
            <p className="text-xs text-slate-400">{tenant.tradeName} ({tenant.slug})</p>
          </div>
        </div>

        {/* Formulario para agregar una nota rápida con fecha */}
        <form onSubmit={handleAppendLog} className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Anotar nueva interacción / seguimiento:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              placeholder="Ej: Hablamos por WhatsApp, el viernes le vence la prueba..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={!newEntry.trim()}
              className="flex items-center gap-1 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white transition"
            >
              <Plus className="h-4 w-4" />
              <span>Anotar</span>
            </button>
          </div>
        </form>

        {/* Historial completo de notas editable */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-400">
            Historial de notas del comercio:
          </label>
          <textarea
            rows={7}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aún no hay notas registradas..."
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none focus:border-slate-700 leading-relaxed font-mono"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleManualSave}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
