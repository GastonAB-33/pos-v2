import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useToast } from "@/components/ui/useToast";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  supportCenterStorage,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/features/support/support-center.storage";
import { isSupportOperator } from "@/features/support/support-operator";
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

export const CentroSoportePage = () => {
  const toast = useToast();
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");

  const refreshTickets = useCallback(() => {
    if (!tenantId) {
      setTickets([]);
      return;
    }

    setTickets(supportCenterStorage.getOpenByTenant(tenantId));
  }, [tenantId]);

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

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  const totals = useMemo(
    () => ({
      abiertas: tickets.filter((ticket) => ticket.status === "abierta").length,
      enProceso: tickets.filter((ticket) => ticket.status === "en_proceso").length,
      esperandoUsuario: tickets.filter((ticket) => ticket.status === "esperando_usuario").length,
    }),
    [tickets]
  );

  const sendSupportReply = () => {
    if (!selectedTicket || !user?.id) return;

    const body = replyMessage.trim();
    if (!body) {
      toast.error("Escribe un mensaje antes de responder");
      return;
    }

    const updated = supportCenterStorage.appendMessage({
      ticketId: selectedTicket.id,
      authorId: user.id,
      authorLabel: user.fullName,
      authorRole: "soporte",
      body,
    });

    if (!updated) {
      toast.error("No se pudo enviar la respuesta");
      return;
    }

    supportCenterStorage.updateStatus(selectedTicket.id, "esperando_usuario");
    setReplyMessage("");
    refreshTickets();
    toast.success("Respuesta enviada");
  };

  const setTicketStatus = (status: SupportTicketStatus) => {
    if (!selectedTicket) return;

    const updated = supportCenterStorage.updateStatus(selectedTicket.id, status);
    if (!updated) {
      toast.error("No se pudo actualizar el estado");
      return;
    }

    refreshTickets();
    toast.success(`Estado actualizado a ${statusLabels[status]}`);
  };

  if (!isSupportOperator(user)) {
    return <Navigate to={routePaths.unauthorized} replace />;
  }

  return (
    <PagePlaceholder
      title="Centro de soporte"
      description="Bandeja interna para desarrollador/soporte. Aqui recibes y respondes consultas abiertas."
    >
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <article className="ui-card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Consultas abiertas</p>
            <span className="ui-badge ui-badge--info">{tickets.length}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="text-xs text-slate-500">Abiertas</p>
              <p className="text-sm font-semibold text-slate-900">{totals.abiertas}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-2">
              <p className="text-xs text-slate-500">En proceso</p>
              <p className="text-sm font-semibold text-slate-900">{totals.enProceso}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
              <p className="text-xs text-slate-500">Esperando</p>
              <p className="text-sm font-semibold text-slate-900">{totals.esperandoUsuario}</p>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div className="ui-empty-state">No hay consultas abiertas ahora.</div>
          ) : (
            <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                    <span className={statusBadgeClass[ticket.status]}>{statusLabels[ticket.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Solicita: {ticket.requesterLabel}</p>
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
          )}
        </article>

        <article className="ui-card space-y-3">
          {selectedTicket ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-900">{selectedTicket.subject}</p>
                  <p className="text-xs text-slate-500">
                    Usuario: {selectedTicket.requesterLabel}
                    {selectedTicket.requesterEmail ? ` · ${selectedTicket.requesterEmail}` : ""}
                  </p>
                </div>
                <span className={statusBadgeClass[selectedTicket.status]}>
                  {statusLabels[selectedTicket.status]}
                </span>
              </div>

              <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                {selectedTicket.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-2 text-xs ${
                      message.authorRole === "soporte"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-sky-300 bg-sky-50"
                    }`}
                  >
                    <p className="font-semibold text-slate-900">
                      {message.authorLabel} {message.authorRole === "soporte" ? "(Soporte)" : "(Usuario)"}
                    </p>
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
                ))}
              </div>

              <textarea
                className="ui-input min-h-24"
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                placeholder="Responder al usuario desde soporte"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ui-btn-primary"
                  onClick={sendSupportReply}
                >
                  Responder
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost"
                  onClick={() => setTicketStatus("en_proceso")}
                >
                  Marcar en proceso
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost"
                  onClick={() => setTicketStatus("esperando_usuario")}
                >
                  Esperando usuario
                </button>
                <button
                  type="button"
                  className="ui-btn-ghost"
                  onClick={() => setTicketStatus("cerrada")}
                >
                  Cerrar consulta
                </button>
              </div>
            </>
          ) : (
            <div className="ui-empty-state">Selecciona una consulta para responder.</div>
          )}
        </article>
      </div>
    </PagePlaceholder>
  );
};
