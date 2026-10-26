import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Eye,
  Image as ImageIcon,
  LifeBuoy,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useToast } from "@/components/ui/useToast";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  supportCenterStorage,
  type SupportTicket,
  type SupportTicketStatus,
  type SupportTicketType,
} from "@/features/support/support-center.storage";
import { isSupportOperator } from "@/features/support/support-operator";
import { storageKeys } from "@/utils/local-storage";
import { cn } from "@/utils/cn";

type FilterTab = "abiertas" | "en_proceso" | "cerradas" | "todas";

const statusLabels: Record<SupportTicketStatus, string> = {
  abierta: "Abierta / Pendiente",
  en_proceso: "En proceso",
  esperando_usuario: "Esperando usuario",
  cerrada: "Resuelta / Cerrada",
};

const statusBadgeClass: Record<SupportTicketStatus, string> = {
  abierta: "ui-badge ui-badge--warn",
  en_proceso: "ui-badge ui-badge--info",
  esperando_usuario: "ui-badge ui-badge--warn",
  cerrada: "ui-badge ui-badge--success",
};

const typeBadgeClass: Record<SupportTicketType, string> = {
  falla: "rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300",
  consulta: "rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sugerencia: "rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

export const CentroSoportePage = () => {
  const toast = useToast();
  const user = useAuthStore((state) => state.user);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("abiertas");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const refreshTickets = useCallback(() => {
    setTickets(supportCenterStorage.getAll());
  }, []);

  useEffect(() => {
    refreshTickets();
    const timer = window.setInterval(refreshTickets, 6_000);

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === storageKeys.supportTickets ||
        event.key === storageKeys.supportSeenByUser
      ) {
        refreshTickets();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("support-tickets-updated", refreshTickets);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("support-tickets-updated", refreshTickets);
    };
  }, [refreshTickets]);

  // Filtrado de tickets por pestaña y búsqueda
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Filtro por pestaña
      if (activeTab === "abiertas" && ticket.status !== "abierta") return false;
      if (activeTab === "en_proceso" && ticket.status !== "en_proceso") return false;
      if (activeTab === "cerradas" && ticket.status !== "cerrada") return false;

      // Filtro por texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchSubject = ticket.subject.toLowerCase().includes(query);
        const matchTenant = ticket.tenantName.toLowerCase().includes(query);
        const matchUser = ticket.requesterLabel.toLowerCase().includes(query);
        const matchModule = ticket.moduleName.toLowerCase().includes(query);
        const matchNumber = String(ticket.ticketNumber).includes(query);
        if (!matchSubject && !matchTenant && !matchUser && !matchModule && !matchNumber) return false;
      }

      return true;
    });
  }, [activeTab, searchQuery, tickets]);

  // Selección automática de primer ticket si ninguno está seleccionado
  useEffect(() => {
    if (!filteredTickets.length) {
      setSelectedTicketId(null);
      return;
    }

    if (!selectedTicketId || !filteredTickets.some((t) => t.id === selectedTicketId)) {
      setSelectedTicketId(filteredTickets[0].id);
    }
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  useEffect(() => {
    if (selectedTicket) {
      setAdminNotes(selectedTicket.adminNotes || "");
    }
  }, [selectedTicket]);

  const totals = useMemo(
    () => ({
      abiertas: tickets.filter((t) => t.status === "abierta").length,
      enProceso: tickets.filter((t) => t.status === "en_proceso").length,
      cerradas: tickets.filter((t) => t.status === "cerrada").length,
      total: tickets.length,
    }),
    [tickets]
  );

  const setTicketStatus = (status: SupportTicketStatus) => {
    if (!selectedTicket) return;

    const updated = supportCenterStorage.updateStatus(selectedTicket.id, status);
    if (!updated) {
      toast.error("No se pudo actualizar el estado");
      return;
    }

    refreshTickets();
    toast.success(`Estado del ticket #${selectedTicket.ticketNumber} actualizado a ${statusLabels[status]}`);
  };

  const handleSaveNotes = () => {
    if (!selectedTicket) return;
    supportCenterStorage.updateAdminNotes(selectedTicket.id, adminNotes);
    refreshTickets();
    toast.success("Notas internas guardadas");
  };

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
      authorLabel: user.fullName || "Soporte Técnico",
      authorRole: "soporte",
      body,
    });

    if (!updated) {
      toast.error("No se pudo enviar la respuesta");
      return;
    }

    supportCenterStorage.updateStatus(selectedTicket.id, "en_proceso");
    setReplyMessage("");
    refreshTickets();
    toast.success("Respuesta registrada en el ticket");
  };

  if (!isSupportOperator(user)) {
    return <Navigate to={routePaths.unauthorized} replace />;
  }

  return (
    <PagePlaceholder
      title="Centro de Soporte y Reportes"
      description="Panel interno para gestión de reportes de clientes con capturas anotadas e información técnica."
    >
      <div className="space-y-4">
        {/* Pestañas de estado superiores */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setActiveTab("abiertas")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                activeTab === "abiertas"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <span>Pendientes</span>
              <span className="rounded-full bg-white/30 px-1.5 py-0.2 text-[10px]">
                {totals.abiertas}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("en_proceso")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                activeTab === "en_proceso"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <span>En Proceso</span>
              <span className="rounded-full bg-white/30 px-1.5 py-0.2 text-[10px]">
                {totals.enProceso}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cerradas")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                activeTab === "cerradas"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <span>Resueltas</span>
              <span className="rounded-full bg-white/30 px-1.5 py-0.2 text-[10px]">
                {totals.cerradas}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("todas")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                activeTab === "todas"
                  ? "bg-slate-800 text-white shadow-sm dark:bg-slate-700"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <span>Todas ({totals.total})</span>
            </button>
          </div>

          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por asunto, comercio o usuario..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
        </div>

        {/* Contenido Principal: Lista lateral + Detalle */}
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* Lista de tickets */}
          <article className="ui-card space-y-2 p-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tickets ({filteredTickets.length})
              </p>
              <button
                type="button"
                onClick={refreshTickets}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                <RefreshCw size={12} />
                <span>Actualizar</span>
              </button>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="ui-empty-state py-8">
                <LifeBuoy size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="font-medium text-slate-600 dark:text-slate-400">No hay tickets en esta vista</p>
              </div>
            ) : (
              <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {filteredTickets.map((ticket) => {
                  const isSelected = ticket.id === selectedTicketId;
                  const formattedDate = new Date(ticket.createdAt).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={cn(
                        "w-full rounded-xl border p-3 text-left transition relative",
                        isSelected
                          ? "border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-400/30 dark:border-blue-500 dark:bg-blue-950/40"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-400">
                          #{ticket.ticketNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={typeBadgeClass[ticket.type]}>
                            {ticket.type === "falla" ? "Falla" : ticket.type === "consulta" ? "Consulta" : "Sugerencia"}
                          </span>
                          <span className={statusBadgeClass[ticket.status]}>
                            {ticket.status === "abierta" ? "Abierta" : ticket.status === "en_proceso" ? "En proceso" : "Resuelta"}
                          </span>
                        </div>
                      </div>

                      <p className="mt-1 text-xs font-bold leading-tight text-slate-900 dark:text-slate-100 line-clamp-2">
                        {ticket.subject}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                          {ticket.tenantName}
                        </span>
                        <span>{formattedDate}</span>
                      </div>

                      {ticket.screenshotDataUrl ? (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-blue-600">
                          <ImageIcon size={12} />
                          <span>Captura con indicaciones</span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </article>

          {/* Detalle del ticket seleccionado */}
          <article className="ui-card space-y-4 p-5">
            {selectedTicket ? (
              <>
                {/* Encabezado del ticket */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-600">
                        Ticket #{selectedTicket.ticketNumber}
                      </span>
                      <span className={typeBadgeClass[selectedTicket.type]}>
                        {selectedTicket.type === "falla" ? "Falla técnica" : selectedTicket.type === "consulta" ? "Consulta" : "Sugerencia"}
                      </span>
                      <span className={statusBadgeClass[selectedTicket.status]}>
                        {statusLabels[selectedTicket.status]}
                      </span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedTicket.subject}
                    </h2>
                  </div>

                  {/* Acciones de cambio de estado */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedTicket.status !== "abierta" ? (
                      <button
                        type="button"
                        onClick={() => setTicketStatus("abierta")}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Reabrir
                      </button>
                    ) : null}

                    {selectedTicket.status !== "en_proceso" ? (
                      <button
                        type="button"
                        onClick={() => setTicketStatus("en_proceso")}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      >
                        Marcar en proceso
                      </button>
                    ) : null}

                    {selectedTicket.status !== "cerrada" ? (
                      <button
                        type="button"
                        onClick={() => setTicketStatus("cerrada")}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                      >
                        ✓ Marcar como Resuelta
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Ficha técnica en 4 columnas */}
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Comercio</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.tenantName}</p>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedTicket.tenantId.slice(0, 10)}...</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Usuario</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.requesterLabel}</p>
                    <span className="text-[10px] text-slate-500">{selectedTicket.requesterRole || "Operador"}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Módulo</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.moduleName}</p>
                    <span className="text-[10px] text-slate-400 font-mono">{selectedTicket.routePath}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dispositivo</span>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.deviceInfo.browser}</p>
                    <span className="text-[10px] text-slate-500">{selectedTicket.deviceInfo.os} ({selectedTicket.deviceInfo.resolution})</span>
                  </div>
                </div>

                {/* Captura de pantalla con indicaciones */}
                {selectedTicket.screenshotDataUrl ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <ImageIcon size={15} className="text-blue-600" />
                        <span>Captura con indicaciones del cliente</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(selectedTicket.screenshotDataUrl)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        <Eye size={13} />
                        <span>Ver en pantalla completa</span>
                      </button>
                    </div>

                    <div
                      onClick={() => setPreviewImage(selectedTicket.screenshotDataUrl)}
                      className="group relative cursor-pointer overflow-hidden rounded-lg border border-slate-300 bg-black/5 text-center transition hover:border-blue-400 dark:border-slate-700"
                    >
                      <img
                        src={selectedTicket.screenshotDataUrl}
                        alt="Captura de soporte"
                        className="mx-auto max-h-72 w-auto object-contain transition duration-200 group-hover:scale-[1.01]"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow">
                          Hacé clic para ampliar captura
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Historial de mensajes y descripción */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Detalle del problema y mensajes
                  </p>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                    {selectedTicket.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-lg border p-3 text-xs",
                          message.authorRole === "soporte"
                            ? "border-emerald-300 bg-emerald-50 text-slate-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-slate-200"
                            : "border-sky-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold">
                            {message.authorLabel} {message.authorRole === "soporte" ? "(Soporte Técnico)" : "(Cliente)"}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(message.createdAt).toLocaleString("es-AR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{message.body}</p>
                      </div>
                    ))}
                  </div>

                  {/* Campo de respuesta al cliente */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendSupportReply();
                        }
                      }}
                      placeholder="Escribir una respuesta al cliente o nota de avance..."
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={sendSupportReply}
                      disabled={!replyMessage.trim()}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send size={13} />
                      <span>Responder</span>
                    </button>
                  </div>
                </div>

                {/* Notas internas privadas (Solo para el Administrador) */}
                <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      🔒 Notas internas privadas (Solo visible para vos)
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
                    >
                      Guardar notas
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Ej: Revisado en código. Bug resuelto en commit abc1234. Pendiente verificar con cliente..."
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </>
            ) : (
              <div className="ui-empty-state py-20">
                <LifeBuoy size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Selecciona un ticket de la lista para ver la captura con indicaciones y su ficha técnica.
                </p>
              </div>
            )}
          </article>
        </div>
      </div>

      {/* Modal Lightbox para ver captura en pantalla completa */}
      {previewImage ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[95vh] max-w-[95vw] overflow-auto rounded-2xl bg-white p-3 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Captura de pantalla con indicaciones
              </p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Captura ampliada"
              className="max-h-[85vh] w-auto rounded-lg object-contain shadow"
            />
          </div>
        </div>
      ) : null}
    </PagePlaceholder>
  );
};
