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
  abierta: "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  en_proceso: "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  esperando_usuario: "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60",
  cerrada: "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60",
};

const typeBadgeClass: Record<SupportTicketType, string> = {
  falla: "inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/60 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60",
  consulta: "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60",
  sugerencia: "inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200/60 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60",
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

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (activeTab === "abiertas" && ticket.status !== "abierta") return false;
      if (activeTab === "en_proceso" && ticket.status !== "en_proceso") return false;
      if (activeTab === "cerradas" && ticket.status !== "cerrada") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchSubject = ticket.subject.toLowerCase().includes(query);
        const matchTenant = ticket.tenantName.toLowerCase().includes(query);
        const matchUser = ticket.requesterLabel.toLowerCase().includes(query);
        const matchTicketNo = String(ticket.ticketNumber).includes(query);
        return matchSubject || matchTenant || matchUser || matchTicketNo;
      }

      return true;
    });
  }, [activeTab, searchQuery, tickets]);

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
    <div className="ui-page operational-page centro-soporte-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">SISTEMA</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">CENTRO DE SOPORTE</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Centro de Soporte
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Panel interno para gestión de reportes de clientes con capturas anotadas e información técnica.
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

      {/* Pestañas de estado + Buscador unificados */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("abiertas")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "abiertas"
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25 font-bold"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <span>Pendientes</span>
            <span className={cn("rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono", activeTab === "abiertas" ? "bg-white/30 text-white" : "bg-slate-100 dark:bg-slate-800")}>
              {totals.abiertas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("en_proceso")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "en_proceso"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25 font-bold"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <span>En Proceso</span>
            <span className={cn("rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono", activeTab === "en_proceso" ? "bg-white/30 text-white" : "bg-slate-100 dark:bg-slate-800")}>
              {totals.enProceso}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cerradas")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "cerradas"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 font-bold"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <span>Resueltas</span>
            <span className={cn("rounded-full px-1.5 py-0.2 text-[10px] font-bold font-mono", activeTab === "cerradas" ? "bg-white/30 text-white" : "bg-slate-100 dark:bg-slate-800")}>
              {totals.cerradas}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("todas")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl sm:rounded-2xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "todas"
                ? "bg-slate-800 text-white shadow-sm dark:bg-slate-700 font-bold"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <span>Todas ({totals.total})</span>
          </button>
        </div>

        <div className="flex min-w-[240px] items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-1.5 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
          <Search size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por asunto, comercio o usuario..."
            className="w-full border-0 bg-transparent px-1 py-0.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Contenido Principal: Lista lateral + Detalle */}
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Lista de tickets */}
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tickets ({filteredTickets.length})
            </p>
            <span className="text-[11px] font-mono text-slate-400">
              Auto-actualiza cada 6s
            </span>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <LifeBuoy size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">No hay tickets en esta vista</p>
            </div>
          ) : (
            <div className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
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
                      "w-full rounded-xl sm:rounded-2xl border p-3 text-left transition relative cursor-pointer",
                      isSelected
                        ? "border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-400/30 dark:border-blue-500 dark:bg-blue-950/40"
                        : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
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

                    <p className="mt-1.5 text-xs font-bold leading-tight text-slate-900 dark:text-slate-100 line-clamp-2">
                      {ticket.subject}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                        {ticket.tenantName}
                      </span>
                      <span className="font-mono">{formattedDate}</span>
                    </div>

                    {(ticket.screenshotDataUrl || ticket.screenshotUrl) ? (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        <ImageIcon size={12} />
                        <span>Captura con anotaciones</span>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </article>

        {/* Detalle del ticket seleccionado */}
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          {selectedTicket ? (
            <>
              {/* Encabezado del ticket */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                      Ticket #{selectedTicket.ticketNumber}
                    </span>
                    <span className={typeBadgeClass[selectedTicket.type]}>
                      {selectedTicket.type === "falla" ? "Falla técnica" : selectedTicket.type === "consulta" ? "Consulta" : "Sugerencia"}
                    </span>
                    <span className={statusBadgeClass[selectedTicket.status]}>
                      {statusLabels[selectedTicket.status]}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedTicket.subject}
                  </h2>
                </div>

                {/* Acciones de cambio de estado */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedTicket.status !== "abierta" ? (
                    <button
                      type="button"
                      onClick={() => setTicketStatus("abierta")}
                      className="rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      Reabrir
                    </button>
                  ) : null}

                  {selectedTicket.status !== "en_proceso" ? (
                    <button
                      type="button"
                      onClick={() => setTicketStatus("en_proceso")}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition-all cursor-pointer"
                    >
                      Marcar en proceso
                    </button>
                  ) : null}

                  {selectedTicket.status !== "cerrada" ? (
                    <button
                      type="button"
                      onClick={() => setTicketStatus("cerrada")}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                    >
                      ✓ Marcar como Resuelta
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Ficha técnica en 4 columnas */}
              <div className="grid grid-cols-2 gap-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs sm:grid-cols-4 dark:border-slate-700/80 dark:bg-slate-800/50">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Comercio</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.tenantName}</p>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedTicket.tenantId.slice(0, 10)}...</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Usuario</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.requesterLabel}</p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{selectedTicket.requesterRole || "Operador"}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Módulo</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.moduleName}</p>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedTicket.routePath}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dispositivo</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selectedTicket.deviceInfo.browser}</p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{selectedTicket.deviceInfo.os} ({selectedTicket.deviceInfo.resolution})</span>
                </div>
              </div>

              {/* Captura de pantalla con indicaciones */}
              {(selectedTicket.screenshotUrl || selectedTicket.screenshotDataUrl) ? (
                <div className="space-y-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <ImageIcon size={15} className="text-blue-600 dark:text-blue-400" />
                      <span>Captura con indicaciones del cliente</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setPreviewImage(selectedTicket.screenshotUrl || selectedTicket.screenshotDataUrl)}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Ver en pantalla completa</span>
                    </button>
                  </div>

                  <div
                    onClick={() => setPreviewImage(selectedTicket.screenshotUrl || selectedTicket.screenshotDataUrl)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-300 bg-black/5 text-center transition hover:border-blue-400 dark:border-slate-700"
                  >
                    <img
                      src={selectedTicket.screenshotUrl || selectedTicket.screenshotDataUrl || ""}
                      alt="Captura de soporte"
                      className="mx-auto max-h-72 w-auto object-contain transition duration-200 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition group-hover:opacity-100">
                      <span className="rounded-xl bg-slate-900/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-md">
                        Hacé clic para ampliar captura
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Historial de mensajes y descripción */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Detalle del problema y mensajes
                </p>
                <div className="max-h-60 space-y-2.5 overflow-y-auto rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
                  {selectedTicket.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-xl border p-3 text-xs",
                        message.authorRole === "soporte"
                          ? "border-emerald-300 bg-emerald-50 text-slate-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-slate-200"
                          : "border-sky-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold">
                          {message.authorLabel} {message.authorRole === "soporte" ? "(Soporte Técnico)" : "(Cliente)"}
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
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Send size={13} />
                    <span>Responder</span>
                  </button>
                </div>
              </div>

              {/* Notas internas privadas */}
              <div className="space-y-2 rounded-xl sm:rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                    🔒 Notas internas privadas (Solo visible para el operador)
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-amber-700 active:scale-95 transition-all cursor-pointer"
                  >
                    Guardar notas
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Ej: Revisado en código. Bug resuelto en commit abc1234. Pendiente verificar con cliente..."
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-amber-500 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-slate-500 dark:text-slate-400">
              <LifeBuoy size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">
                Selecciona un ticket de la lista para ver la captura con indicaciones y su ficha técnica.
              </p>
            </div>
          )}
        </article>
      </div>

      {/* Modal Lightbox para ver captura en pantalla completa */}
      {previewImage ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[95vh] max-w-[95vw] overflow-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Captura de pantalla con indicaciones
              </p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Captura ampliada"
              className="max-h-[85vh] w-auto rounded-xl object-contain shadow"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};