import React from "react";
import { CrmLead, LeadStage } from "../types/crm.types";
import { MessageSquare, Phone, Store, User, ArrowRight, ArrowLeft, Clock, DollarSign } from "lucide-react";

interface CrmPipelineProps {
  leads: CrmLead[];
  onMoveStage: (leadId: string, newStage: LeadStage) => void;
}

export const CrmPipeline: React.FC<CrmPipelineProps> = ({ leads, onMoveStage }) => {
  const columns: { id: LeadStage; title: string; color: string; badge: string }[] = [
    { id: "lead", title: "1. Nuevos Leads", color: "border-sky-500/40 bg-sky-950/20", badge: "bg-sky-500/20 text-sky-300" },
    { id: "trial", title: "2. Trial 7 Días", color: "border-amber-500/40 bg-amber-950/20", badge: "bg-amber-500/20 text-amber-300" },
    { id: "contacted", title: "3. En Negociación", color: "border-purple-500/40 bg-purple-950/20", badge: "bg-purple-500/20 text-purple-300" },
    { id: "won", title: "4. Clientes Oficiales", color: "border-emerald-500/40 bg-emerald-950/20", badge: "bg-emerald-500/20 text-emerald-300" },
    { id: "lost", title: "5. No Concretados", color: "border-slate-800 bg-slate-900/20", badge: "bg-slate-800 text-slate-400" },
  ];

  const stageOrder: LeadStage[] = ["lead", "trial", "contacted", "won", "lost"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Embudo de Ventas y Seguimiento (CRM)</h3>
          <p className="text-xs text-slate-400">
            Mueve los leads a través de las etapas del ciclo de conversión de prueba gratuita a clientes oficiales.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.stage === col.id);
          const colMrr = colLeads.reduce((sum, l) => sum + (l.estimatedMrr || 0), 0);

          return (
            <div
              key={col.id}
              className={`rounded-2xl border ${col.color} p-3.5 flex flex-col min-w-[240px]`}
            >
              {/* Encabezado de la columna */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
                <span className="text-xs font-bold text-white">{col.title}</span>
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {colLeads.length}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 font-semibold mb-3 flex items-center justify-between">
                <span>MRR Estimado:</span>
                <span className="text-emerald-400 font-bold">${colMrr.toLocaleString("es-AR")}</span>
              </div>

              {/* Tarjetas de Leads */}
              <div className="space-y-2.5 flex-1">
                {colLeads.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-600 italic">
                    Sin comercios en esta etapa
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const currentIndex = stageOrder.indexOf(lead.stage);
                    const canMoveLeft = currentIndex > 0;
                    const canMoveRight = currentIndex < stageOrder.length - 1;

                    const whatsappMsg = encodeURIComponent(
                      lead.stage === "lead"
                        ? `Hola ${lead.contactName}! Te escribo de Jireh POS respecto a tu consulta para ${lead.businessName}. ¿En qué podemos ayudarte?`
                        : lead.stage === "trial"
                        ? `Hola ${lead.contactName}! ¿Cómo va tu prueba de 7 días en ${lead.businessName}? ¿Querés que coordinemos una videollamada para sacarte dudas?`
                        : `Hola ${lead.contactName}! Te contacto desde la gerencia de Jireh POS respecto a tu cuenta.`
                    );

                    return (
                      <div
                        key={lead.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-md hover:border-slate-700 transition space-y-2"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-white leading-tight">
                            {lead.businessName}
                          </h5>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {lead.category}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 space-y-0.5 border-t border-slate-800/80 pt-1.5">
                          <div className="flex items-center gap-1 text-slate-400">
                            <User className="h-3 w-3 text-slate-500" />
                            <span>{lead.contactName}</span>
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-sky-400 font-medium">{lead.selectedPlan}</span>
                            <span className="font-bold text-emerald-400">
                              ${lead.estimatedMrr.toLocaleString("es-AR")}
                            </span>
                          </div>
                        </div>

                        {lead.notes && (
                          <p className="text-[10px] text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/50 line-clamp-2">
                            {lead.notes}
                          </p>
                        )}

                        {/* Botón WhatsApp directo */}
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}?text=${whatsappMsg}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Navegación rápida de etapas */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                          {canMoveLeft ? (
                            <button
                              type="button"
                              onClick={() => onMoveStage(lead.id, stageOrder[currentIndex - 1])}
                              className="text-slate-500 hover:text-white p-1 rounded transition flex items-center gap-0.5"
                              title="Retroceder etapa"
                            >
                              <ArrowLeft className="h-3 w-3" />
                              <span>Atrás</span>
                            </button>
                          ) : <div />}

                          {canMoveRight ? (
                            <button
                              type="button"
                              onClick={() => onMoveStage(lead.id, stageOrder[currentIndex + 1])}
                              className="text-sky-400 hover:text-sky-300 font-bold p-1 rounded transition flex items-center gap-0.5"
                              title="Avanzar etapa"
                            >
                              <span>Avanzar</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : <div />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
