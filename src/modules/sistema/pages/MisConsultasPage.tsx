import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Send, MessageSquare, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  supportCenterStorage,
  type SupportTicket,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/features/support/support-center.storage";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { storageKeys } from "@/utils/local-storage";
import { cn } from "@/utils/cn";

const statusLabels: Record<SupportTicketStatus, string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  esperando_usuario: "Esperando tu respuesta",
  cerrada: "Cerrada",
};

const statusBadgeClass: Record<SupportTicketStatus, string> = {
  abierta: "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  en_proceso: "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  esperando_usuario: "inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60",
  cerrada: "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
};

export const MisConsultasPage = () => {
  const toast = useToast();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newType, setNewType] = useState<SupportTicketType>("sugerencia");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const refreshTickets = useCallback(() => {
    if (!tenantId || !user?.id) {
      setTickets([]);
      return;
    }

    const openTickets = supportCenterStorage.getOpenByTenantForUser(tenantId, user.id);
    setTickets(openTickets);
  }, [tenantId, user?.id]);

  useEffect(() => {
    refreshTickets();

    const timer = window.setInterval(refreshTickets, 8_000);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === storageKeys.supportTickets ||
        event.key === storageKeys.supportSeenByUser
      ) {
        refreshTickets();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshTickets]);

  useEffect(() => {
    if (!tickets.length) {
      setSelectedTicketId(null);
      return;
    }

    if (!selectedTicketId || !tickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(tickets[0].id);
    }
  }, [selectedTicketId, tickets]);

  useEffect(() => {
    if (!tenantId || !user?.id) return;
    supportCenterStorage.markSeenForUser(tenantId, user.id);
  }, [selectedTicketId, tenantId, user?.id]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  const createTicket = () => {
    if (!tenantId || !user?.id) {
      toast.error("Debes iniciar sesión para crear consultas");
      return;
    }

    const subject = newSubject.trim();
    const message = newMessage.trim();
    if (!subject || !message) {
      toast.error("Completa asunto y detalle para abrir la consulta");
      return;
    }

    const created = supportCenterStorage.createTicket({
      tenantId,
      type: newType,
      subject,
      body: message,
      requesterUserId: user.id,
      requesterLabel: user.fullName,
      requesterEmail: user.email,
    });

    setNewSubject("");
    setNewMessage("");
    refreshTickets();
    setSelectedTicketId(created.id);
    toast.success("Consulta enviada a soporte técnico");
  };

  const sendReply = () => {
    if (!selectedTicket || !user?.id) return;

    const body = replyMessage.trim();
    if (!body) {
      toast.error("Escribe un mensaje para continuar la consulta");
      return;
    }

    const updated = supportCenterStorage.appendMessage({
      ticketId: selectedTicket.id,
      authorId: user.id,
      authorLabel: user.fullName,
      authorRole: "usuario",
      body,
    });

    if (!updated) {
      toast.error("No se pudo enviar el mensaje");
      return;
    }

    setReplyMessage("");
    refreshTickets();
    toast.success("Mensaje enviado en la consulta");
  };

  const closeTicket = () => {
    if (!selectedTicket) return;
    supportCenterStorage.updateStatus(selectedTicket.id, "cerrada");
    refreshTickets();
    toast.success("Consulta cerrada correctamente");
  };

  return (
    <div className="ui-page operational-page mis-consultas-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">MIS CONSULTAS</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Mis Consultas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Seguimiento de consultas abiertas y comunicación directa con el equipo de soporte técnico.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={refreshTickets}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Formulario de Nueva Consulta */}
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Abrir nueva consulta</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Envía una duda, sugerencia o reporte de funcionamiento.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200" htmlFor="new-ticket-type">
              Tipo de consulta
            </label>
            <select
              id="new-ticket-type"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 cursor-pointer"
              value={newType}
              onChange={(event) => setNewType(event.target.value as SupportTicketType)}
            >
              <option value="sugerencia">Sugerencia de mejora</option>
              <option value="falla">Reporte de falla / error</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200" htmlFor="new-ticket-subject">
              Asunto
            </label>
            <input
              id="new-ticket-subject"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
              value={newSubject}
              onChange={(event) => setNewSubject(event.target.value)}
              placeholder="Resumen breve del caso..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200" htmlFor="new-ticket-message">
              Detalle
            </label>
            <textarea
              id="new-ticket-message"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 min-h-28"
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder="Describe lo que necesitas con el mayor detalle posible..."
            />
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
            onClick={createTicket}
          >
            Enviar consulta a soporte
          </button>
        </article>

        {/* Listado y conversación de consultas abiertas */}
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Consultas activas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona una consulta para ver las respuestas y enviar comentarios.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 font-mono">
              {tickets.length} activa{tickets.length === 1 ? "" : "s"}
            </span>
          </div>

          {tickets.length === 0 ? (
            <div className="py-20 text-center text-slate-500 dark:text-slate-400">
              <MessageSquare size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">No tienes consultas abiertas actualmente.</p>
              <p className="mt-1 text-xs">Abre una nueva consulta desde el formulario lateral cuando lo necesites.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
              {/* Lista lateral de consultas */}
              <div className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
                {tickets.map((ticket) => {
                  const isSelected = ticket.id === selectedTicketId;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={cn(
                        "w-full rounded-xl sm:rounded-2xl border p-3.5 text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-400/30 dark:border-blue-500 dark:bg-blue-950/40"
                          : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                        {ticket.subject}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium">
                          {ticket.type === "falla" ? "Falla" : "Sugerencia"}
                        </span>
                        <span className="font-mono">
                          {new Date(ticket.updatedAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Conversación / Detalle de la consulta */}
              <div className="space-y-4 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-800/40">
                {selectedTicket ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-700/80">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{selectedTicket.subject}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {selectedTicket.type === "falla" ? "Reporte de falla técnica" : "Sugerencia de mejora"} • Ticket #{selectedTicket.ticketNumber}
                        </p>
                      </div>
                      <span className={statusBadgeClass[selectedTicket.status]}>
                        {statusLabels[selectedTicket.status]}
                      </span>
                    </div>

                    <div className="max-h-[300px] space-y-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
                      {selectedTicket.messages.map((message) => {
                        const isRequester = message.authorId === selectedTicket.requesterUserId;
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "rounded-xl border p-3 text-xs leading-relaxed",
                              isRequester
                                ? "border-sky-200 bg-sky-50 text-slate-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-slate-200"
                                : "border-emerald-200 bg-emerald-50 text-slate-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-slate-200"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/50 pb-1.5 mb-1.5 dark:border-slate-700/50">
                              <p className="font-bold">
                                {message.authorLabel} {isRequester ? "(Vos)" : "(Soporte Técnico)"}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(message.createdAt).toLocaleString("es-AR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{message.body}</p>
                          </div>
                        );
                      })}
                    </div>

                    <textarea
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 min-h-24"
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder="Escribe una respuesta o consulta adicional..."
                    />

                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={closeTicket}
                        className="rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                      >
                        <CheckCircle2 size={15} className="inline mr-1 text-slate-500" />
                        <span>Cerrar consulta</span>
                      </button>

                      <button
                        type="button"
                        onClick={sendReply}
                        disabled={!replyMessage.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <Send size={14} />
                        <span>Enviar mensaje</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center text-slate-500 dark:text-slate-400">
                    <p className="text-sm font-medium">Selecciona una consulta para ver su detalle.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
};