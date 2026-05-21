import { useCallback, useEffect, useMemo, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
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

const statusLabels: Record<SupportTicketStatus, string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  esperando_usuario: "Esperando usuario",
  cerrada: "Cerrada",
};

const statusBadgeClass: Record<SupportTicketStatus, string> = {
  abierta: "ui-badge ui-badge--warn",
  en_proceso: "ui-badge ui-badge--info",
  esperando_usuario: "ui-badge ui-badge--success",
  cerrada: "ui-badge ui-badge--danger",
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
      toast.error("Debes iniciar sesion para crear consultas");
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
    setSelectedTicketId(created.id);
    refreshTickets();
    toast.success("Consulta creada");
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
    toast.success("Consulta cerrada");
  };

  return (
    <PagePlaceholder
      title="Mis consultas"
      description="Seguimiento interno de soporte. Aqui ves solo consultas abiertas y puedes continuar la conversacion."
    >
      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <article className="ui-card space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Nueva consulta</h3>

          <label className="text-xs text-slate-500" htmlFor="new-ticket-type">
            Tipo
          </label>
          <select
            id="new-ticket-type"
            className="ui-input"
            value={newType}
            onChange={(event) => setNewType(event.target.value as SupportTicketType)}
          >
            <option value="sugerencia">Sugerencia</option>
            <option value="falla">Reporte de falla</option>
          </select>

          <label className="text-xs text-slate-500" htmlFor="new-ticket-subject">
            Asunto
          </label>
          <input
            id="new-ticket-subject"
            className="ui-input"
            value={newSubject}
            onChange={(event) => setNewSubject(event.target.value)}
            placeholder="Resumen corto del caso"
          />

          <label className="text-xs text-slate-500" htmlFor="new-ticket-message">
            Detalle
          </label>
          <textarea
            id="new-ticket-message"
            className="ui-input min-h-24"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            placeholder="Describe lo que necesitas"
          />

          <button type="button" className="ui-btn-primary w-full" onClick={createTicket}>
            Abrir consulta
          </button>
        </article>

        <article className="ui-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Consultas abiertas</h3>
            <span className="ui-badge ui-badge--info">{tickets.length}</span>
          </div>

          {tickets.length === 0 ? (
            <div className="ui-empty-state">No tienes consultas abiertas actualmente.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      ticket.id === selectedTicketId
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {ticket.type === "falla" ? "Reporte de falla" : "Sugerencia"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {new Date(ticket.updatedAt).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </p>
                  </button>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                {selectedTicket ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{selectedTicket.subject}</p>
                        <p className="text-xs text-slate-500">
                          {selectedTicket.type === "falla" ? "Reporte de falla" : "Sugerencia"}
                        </p>
                      </div>
                      <span className={statusBadgeClass[selectedTicket.status]}>
                        {statusLabels[selectedTicket.status]}
                      </span>
                    </div>

                    <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                      {selectedTicket.messages.map((message) => {
                        const isRequester = message.authorId === selectedTicket.requesterUserId;
                        return (
                          <div
                            key={message.id}
                            className={`rounded-lg border p-2 text-xs ${
                              isRequester ? "border-sky-300 bg-sky-50" : "border-emerald-300 bg-emerald-50"
                            }`}
                          >
                            <p className="font-semibold text-slate-900">{message.authorLabel}</p>
                            <p className="mt-1 text-slate-700">{message.body}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {new Date(message.createdAt).toLocaleString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "America/Argentina/Buenos_Aires",
                              })}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <textarea
                      className="ui-input min-h-24"
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder="Escribe un seguimiento para esta consulta"
                    />

                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className="ui-btn-ghost" onClick={closeTicket}>
                        Cerrar consulta
                      </button>
                      <button type="button" className="ui-btn-primary" onClick={sendReply}>
                        Enviar mensaje
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="ui-empty-state">Selecciona una consulta para ver su detalle.</div>
                )}
              </div>
            </div>
          )}
        </article>
      </div>
    </PagePlaceholder>
  );
};
