import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CircleEllipsis, Headphones, Menu, RefreshCw, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/useToast";
import { env } from "@/config/env";
import { routePaths } from "@/config/routes";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOffline } from "@/features/offline/hooks/useOffline";
import { usePwa } from "@/features/pwa/hooks/usePwa";
import { supportCenterStorage, type SupportTicket } from "@/features/support/support-center.storage";
import { isSupportOperator } from "@/features/support/support-operator";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { authService } from "@/services/auth.service";
import { productsService } from "@/services/products.service";
import { usersService } from "@/services/users.service";
import { useUiStore } from "@/store/ui.store";
import type { Product, UserRecord } from "@/types/entities";
import { storageKeys } from "@/utils/local-storage";

type TopbarPanel = "support" | "tasks" | "chat" | "notifications" | "user" | "more" | null;
type SupportType = "sugerencia" | "falla";
type TaskStatus = "pendiente" | "completada";

interface SupportOutboxItem {
  id: string;
  ticketId: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  type: SupportType;
  subject: string;
  message: string;
  status: "sent" | "queued";
  user: {
    id: string;
    fullName: string;
    email: string | null;
    username: string | null;
  };
}

interface TaskItem {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  assignedToUserId: string;
  assignedToLabel: string;
  assignedByUserId: string;
  assignedByLabel: string;
  createdAt: string;
  status: TaskStatus;
  completedAt: string | null;
}

interface ChatMessage {
  id: string;
  tenantId: string;
  senderId: string;
  senderLabel: string;
  recipientId: string;
  recipientLabel: string;
  body: string;
  createdAt: string;
  readByUserIds: string[];
}

type PresenceMap = Record<string, string>;

const routeLabels: Array<{ path: string; label: string }> = [
  { path: routePaths.menuPrincipal, label: "Menu principal" },
  { path: routePaths.dashboard, label: "Estadisticas" },
  { path: routePaths.clientes, label: "Clientes" },
  { path: routePaths.proveedores, label: "Proveedores" },
  { path: routePaths.productos, label: "Productos" },
  { path: routePaths.stock, label: "Stock" },
  { path: routePaths.listasPrecios, label: "Listas de precios" },
  { path: routePaths.promociones, label: "Promociones" },
  { path: routePaths.compras, label: "Compras a proveedores" },
  { path: routePaths.caja, label: "Caja" },
  { path: routePaths.cuentasCorrientes, label: "Cuentas corrientes" },
  { path: routePaths.comprobantes, label: "Comprobantes" },
  { path: routePaths.mediosPago, label: "Medios de pago" },
  { path: routePaths.facturacion, label: "Facturacion" },
  { path: routePaths.reportes, label: "Reportes" },
  { path: routePaths.auditoria, label: "Auditoria" },
  { path: routePaths.usuarios, label: "Usuarios" },
  { path: routePaths.configuracion, label: "Configuracion" },
  { path: routePaths.configuracionAgenda, label: "Config. Agenda" },
  { path: routePaths.configuracionCatalogo, label: "Config. Catalogo" },
  { path: routePaths.configuracionAnalisis, label: "Config. Analisis" },
  { path: routePaths.configuracionSistema, label: "Config. Sistema" },
  { path: routePaths.altaComercio, label: "Alta de comercio" },
  { path: routePaths.centroSoporte, label: "Centro soporte" },
  { path: routePaths.misConsultas, label: "Mis consultas" },
  { path: routePaths.configuracionContable, label: "Config. Contable" },
];

const readStorageArray = <T,>(key: string): T[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const writeStorageArray = <T,>(key: string, rows: T[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Ignorar errores de storage para no romper UX.
  }
};

const readPresenceMap = (): PresenceMap => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKeys.topbarPresence);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as PresenceMap) : {};
  } catch {
    return {};
  }
};

const writePresenceMap = (map: PresenceMap) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKeys.topbarPresence, JSON.stringify(map));
  } catch {
    // Ignorar errores de storage para no romper UX.
  }
};

const getDisplayName = (candidate: {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  fallback?: string;
}) => {
  return (
    candidate.fullName?.trim() ||
    candidate.username?.trim() ||
    candidate.email?.trim() ||
    candidate.fallback ||
    "Usuario"
  );
};

export const Topbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { tenant, tenantId } = useTenant();
  const {
    connectionState,
    isOnline,
    isSyncing,
    totalPendingCount,
    lastSyncMessage,
    lastSyncError,
    syncNow,
    clearSyncError,
  } = useOffline();
  const { canInstall, isInstalling, isInstalled, installApp, isInstallSupported } = usePwa();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const [now, setNow] = useState(() => new Date());
  const [activePanel, setActivePanel] = useState<TopbarPanel>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  const [supportType, setSupportType] = useState<SupportType>("sugerencia");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");

  const [chatRecipientId, setChatRecipientId] = useState("");
  const [chatText, setChatText] = useState("");

  const currentTitle = useMemo(() => {
    const match = routeLabels.find(
      ({ path }) => location.pathname === path || location.pathname.startsWith(`${path}/`)
    );

    return match?.label ?? "Panel";
  }, [location.pathname]);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Argentina/Buenos_Aires",
    })
      .format(now)
      .replace(",", "")
      .trim();
  }, [now]);

  const connectionLabel =
    connectionState === "syncing" ? "Sincronizando" : connectionState === "online" ? "Conectado" : "Sin conexion";
  const connectionBadgeClass =
    connectionState === "syncing"
      ? "ui-badge ui-badge--warn"
      : connectionState === "online"
        ? "ui-badge ui-badge--success"
        : "ui-badge ui-badge--danger";

  const tenantName = tenant?.tradeName ?? "Sin comercio";
  const currentUserId = user?.id ?? "";
  const isSupportProfile = isSupportOperator(user);
  const currentUserLabel = getDisplayName({
    fullName: user?.fullName,
    username: user?.username,
    email: user?.email,
    fallback: "Invitado",
  });
  const supportWhatsappUrl = useMemo(() => {
    if (!env.supportWhatsappPhone) return "";

    const message = [
      "Hola, necesito soporte para el sistema POS.",
      `Comercio: ${tenantName}`,
      `Usuario: ${currentUserLabel}`,
      `Modulo actual: ${currentTitle}`,
    ].join("\n");

    return `https://wa.me/${env.supportWhatsappPhone}?text=${encodeURIComponent(message)}`;
  }, [currentTitle, currentUserLabel, tenantName]);

  const usersForAssignments = useMemo(() => {
    const deduped = new Map<string, UserRecord>();
    for (const item of users) {
      if (!item.id) continue;
      deduped.set(item.id, item);
    }

    if (user && !deduped.has(user.id)) {
      deduped.set(user.id, {
        id: user.id,
        tenant_id: tenantId ?? user.tenantId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        full_name: user.fullName,
        email: user.email,
        username: user.username,
        role_code: user.role,
        permission_profile_id: user.permissionProfileId ?? "",
        is_active: user.isActive,
      });
    }

    return [...deduped.values()].filter((item) => item.is_active !== false);
  }, [now, tenantId, user, users]);

  const tasksAssignedToMe = useMemo(
    () => tasks.filter((task) => task.assignedToUserId === currentUserId),
    [currentUserId, tasks]
  );
  const pendingTasksCount = useMemo(
    () => tasksAssignedToMe.filter((task) => task.status === "pendiente").length,
    [tasksAssignedToMe]
  );

  const unreadChatCount = useMemo(() => {
    return chatMessages.filter(
      (message) =>
        message.recipientId === currentUserId &&
        message.senderId !== currentUserId &&
        !message.readByUserIds.includes(currentUserId)
    ).length;
  }, [chatMessages, currentUserId]);

  const openSupportTickets = useMemo(
    () =>
      supportTickets.filter(
        (ticket) => ticket.requesterUserId === currentUserId && ticket.status !== "cerrada"
      ),
    [currentUserId, supportTickets]
  );
  const supportInboxCount = useMemo(
    () => supportTickets.filter((ticket) => ticket.status !== "cerrada").length,
    [supportTickets]
  );
  const unreadSupportCount = useMemo(
    () => (tenantId && currentUserId ? supportCenterStorage.getUnreadCountForUser(tenantId, currentUserId) : 0),
    [activePanel, currentUserId, supportTickets, tenantId]
  );
  const notificationCount = lowStockProducts.length + openSupportTickets.length;

  const chatRecipient = useMemo(
    () => usersForAssignments.find((item) => item.id === chatRecipientId) ?? null,
    [chatRecipientId, usersForAssignments]
  );

  const currentConversation = useMemo(() => {
    if (!chatRecipientId || !currentUserId) return [];

    return chatMessages
      .filter(
        (message) =>
          (message.senderId === currentUserId && message.recipientId === chatRecipientId) ||
          (message.senderId === chatRecipientId && message.recipientId === currentUserId)
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [chatMessages, chatRecipientId, currentUserId]);

  const refreshTenantStreams = useCallback(() => {
    if (!tenantId) {
      setTasks([]);
      setChatMessages([]);
      setPresenceMap({});
      setSupportTickets([]);
      return;
    }

    const taskRows = readStorageArray<TaskItem>(storageKeys.topbarTasks).filter((item) => item.tenantId === tenantId);
    const messageRows = readStorageArray<ChatMessage>(storageKeys.topbarChatMessages).filter(
      (item) => item.tenantId === tenantId
    );

    setTasks(taskRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setChatMessages(messageRows);
    setPresenceMap(readPresenceMap());
    setSupportTickets(supportCenterStorage.getByTenant(tenantId));
  }, [tenantId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      if (!tenantId) {
        setUsers([]);
        return;
      }

      try {
        const rows = await usersService.getAllByTenant(tenantId);
        if (!active) return;
        setUsers(rows);
      } catch {
        if (!active) return;
        setUsers([]);
      }
    };

    void loadUsers();

    return () => {
      active = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let active = true;

    const loadStockNotifications = async () => {
      if (!tenantId) {
        setLowStockProducts([]);
        return;
      }

      try {
        const products = await productsService.getAllByTenant(tenantId);
        if (!active) return;
        const lowStock = products
          .filter((product) => product.is_active)
          .filter((product) => {
            if (typeof product.stock_min === "number") {
              return product.stock_current <= product.stock_min;
            }
            return product.stock_current <= 0;
          })
          .sort((a, b) => a.stock_current - b.stock_current)
          .slice(0, 8);
        setLowStockProducts(lowStock);
      } catch {
        if (!active) return;
        setLowStockProducts([]);
      }
    };

    void loadStockNotifications();
    const poll = window.setInterval(() => {
      void loadStockNotifications();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [tenantId]);

  useEffect(() => {
    refreshTenantStreams();
    const poll = window.setInterval(refreshTenantStreams, 10_000);

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === storageKeys.topbarTasks ||
        event.key === storageKeys.topbarChatMessages ||
        event.key === storageKeys.topbarPresence ||
        event.key === storageKeys.supportTickets ||
        event.key === storageKeys.supportSeenByUser
      ) {
        refreshTenantStreams();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshTenantStreams]);

  useEffect(() => {
    if (!user?.id) return;

    const updatePresence = () => {
      const latest = readPresenceMap();
      latest[user.id] = new Date().toISOString();
      writePresenceMap(latest);
      setPresenceMap(latest);
    };

    updatePresence();
    const timer = window.setInterval(updatePresence, 20_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!chatRecipientId || !currentUserId || !tenantId) return;

    const all = readStorageArray<ChatMessage>(storageKeys.topbarChatMessages);
    let changed = false;
    const next = all.map((message) => {
      const isConversationMessage =
        message.tenantId === tenantId &&
        message.senderId === chatRecipientId &&
        message.recipientId === currentUserId;
      if (!isConversationMessage || message.readByUserIds.includes(currentUserId)) {
        return message;
      }

      changed = true;
      return {
        ...message,
        readByUserIds: [...message.readByUserIds, currentUserId],
      };
    });

    if (!changed) return;

    writeStorageArray(storageKeys.topbarChatMessages, next);
    refreshTenantStreams();
  }, [chatRecipientId, currentUserId, refreshTenantStreams, tenantId]);

  const togglePanel = (panel: TopbarPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));

    if (panel === "notifications" && tenantId && currentUserId) {
      supportCenterStorage.markSeenForUser(tenantId, currentUserId);
    }
  };

  const submitSupport = async () => {
    if (!user || !tenantId) {
      toast.error("Debes iniciar sesion para enviar soporte");
      return;
    }

    const subject = supportSubject.trim();
    const message = supportMessage.trim();

    if (!subject || !message) {
      toast.error("Completa asunto y detalle para enviar soporte");
      return;
    }

    const ticket = supportCenterStorage.createTicket({
      tenantId,
      type: supportType,
      subject,
      body: message,
      requesterUserId: user.id,
      requesterLabel: user.fullName,
      requesterEmail: user.email,
    });

    const baseRecord: SupportOutboxItem = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      tenantId,
      tenantName,
      createdAt: new Date().toISOString(),
      type: supportType,
      subject,
      message,
      status: "queued",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
      },
    };

    setIsSendingSupport(true);

    const payload = {
      category: supportType,
      subject,
      message,
      tenant: {
        id: tenantId,
        name: tenantName,
      },
      ticket: {
        id: ticket.id,
      },
      context: {
        createdAt: baseRecord.createdAt,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: "es-AR",
      },
      requester: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        responseEmail: user.email,
      },
    };

    let status: "sent" | "queued" = "queued";

    try {
      const supportUrl = env.apiUrl ? `${env.apiUrl.replace(/\/$/, "")}/support/requests` : "";
      if (!supportUrl) {
        throw new Error("missing-api-url");
      }

      const response = await fetch(supportUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`support-http-${response.status}`);
      }

      status = "sent";
      toast.success("Soporte enviado correctamente");
    } catch {
      toast.info("Solicitud guardada en cola local. Se enviara al conectar backend de soporte.");
    } finally {
      const outbox = readStorageArray<SupportOutboxItem>(storageKeys.topbarSupportOutbox);
      outbox.unshift({
        ...baseRecord,
        status,
      });
      writeStorageArray(storageKeys.topbarSupportOutbox, outbox.slice(0, 200));
      setSupportSubject("");
      setSupportMessage("");
      setIsSendingSupport(false);
      setActivePanel(null);
      refreshTenantStreams();
    }
  };

  const createTask = () => {
    if (!tenantId || !currentUserId) {
      toast.error("Debes iniciar sesion para crear tareas");
      return;
    }

    const title = taskTitle.trim();
    const description = taskDescription.trim();

    if (!title || !description || !taskAssigneeId) {
      toast.error("Completa titulo, descripcion y destinatario");
      return;
    }

    const assignee = usersForAssignments.find((item) => item.id === taskAssigneeId);
    if (!assignee) {
      toast.error("Selecciona un usuario valido");
      return;
    }

    const record: TaskItem = {
      id: crypto.randomUUID(),
      tenantId,
      title,
      description,
      assignedToUserId: assignee.id,
      assignedToLabel: getDisplayName({
        fullName: assignee.full_name,
        username: assignee.username,
        email: assignee.email,
      }),
      assignedByUserId: currentUserId,
      assignedByLabel: currentUserLabel,
      createdAt: new Date().toISOString(),
      status: "pendiente",
      completedAt: null,
    };

    const all = readStorageArray<TaskItem>(storageKeys.topbarTasks);
    all.unshift(record);
    writeStorageArray(storageKeys.topbarTasks, all);
    refreshTenantStreams();

    setTaskTitle("");
    setTaskDescription("");
    setTaskAssigneeId("");
    toast.success("Tarea creada y asignada");
  };

  const toggleTaskStatus = (taskId: string) => {
    const all = readStorageArray<TaskItem>(storageKeys.topbarTasks);
    const next = all.map((task) => {
      if (task.id !== taskId) return task;

      if (task.status === "pendiente") {
        return {
          ...task,
          status: "completada" as const,
          completedAt: new Date().toISOString(),
        };
      }

      return {
        ...task,
        status: "pendiente" as const,
        completedAt: null,
      };
    });

    writeStorageArray(storageKeys.topbarTasks, next);
    refreshTenantStreams();
  };

  const sendChatMessage = () => {
    if (!tenantId || !currentUserId) {
      toast.error("Debes iniciar sesion para usar el chat");
      return;
    }

    const body = chatText.trim();
    if (!chatRecipientId || !body) {
      toast.error("Selecciona destinatario y escribe un mensaje");
      return;
    }

    const recipient = usersForAssignments.find((item) => item.id === chatRecipientId);
    if (!recipient) {
      toast.error("El destinatario ya no esta disponible");
      return;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      tenantId,
      senderId: currentUserId,
      senderLabel: currentUserLabel,
      recipientId: recipient.id,
      recipientLabel: getDisplayName({
        fullName: recipient.full_name,
        username: recipient.username,
        email: recipient.email,
      }),
      body,
      createdAt: new Date().toISOString(),
      readByUserIds: [currentUserId],
    };

    const all = readStorageArray<ChatMessage>(storageKeys.topbarChatMessages);
    all.push(message);
    writeStorageArray(storageKeys.topbarChatMessages, all);
    refreshTenantStreams();
    setChatText("");
  };

  const isUserOnline = (targetUserId: string) => {
    const lastSeen = presenceMap[targetUserId];
    if (!lastSeen) return false;

    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff <= 120_000;
  };

  return (
    <header className="app-topbar relative">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="app-menu-button ui-btn-ghost"
          aria-label="Abrir menu"
          onClick={toggleSidebar}
        >
          <Menu aria-hidden="true" size={19} />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-slate-900 capitalize">{formattedDate}</p>
          <p className="truncate text-xs text-slate-500">{currentTitle} · {tenantName}</p>
          {lastSyncMessage ? (
            <p className={`truncate text-[11px] ${lastSyncError ? "text-red-600" : "text-slate-500"}`}>{lastSyncMessage}</p>
          ) : null}
        </div>
      </div>

      <div className="app-topbar-actions flex items-center gap-2 md:gap-3">
        {supportWhatsappUrl ? (
          <a
            className="ui-btn-primary app-topbar-support text-xs"
            href={supportWhatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp soporte
          </a>
        ) : null}

        <button type="button" className="ui-btn-ghost gap-1.5 text-xs" onClick={() => togglePanel("support")}>
          <Headphones aria-hidden="true" size={15} />
          <span>Soporte</span>
        </button>

        <button type="button" className="ui-btn-ghost gap-1.5 text-xs" onClick={() => togglePanel("notifications")}>
          <Bell aria-hidden="true" size={15} />
          <span>Alertas {notificationCount > 0 ? `(${notificationCount})` : ""}</span>
        </button>

        <button type="button" className="ui-btn-ghost gap-1.5 text-xs" onClick={() => togglePanel("more")}>
          <CircleEllipsis aria-hidden="true" size={16} />
          <span>Mas {pendingTasksCount + unreadChatCount > 0 ? `(${pendingTasksCount + unreadChatCount})` : ""}</span>
        </button>

        <button
          type="button"
          className="ui-btn-ghost app-topbar-user gap-2 text-right"
          aria-label={`Opciones de ${currentUserLabel}`}
          onClick={() => togglePanel("user")}
        >
          <UserRound aria-hidden="true" size={16} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-900">{currentUserLabel}</span>
            <span className="block truncate text-xs text-slate-500">{user?.email ?? "sin-sesion@local"}</span>
          </span>
        </button>
      </div>

      {activePanel === "more" ? (
        <div className="ui-card app-topbar-popover absolute right-6 top-[calc(100%+8px)] z-40 w-full max-w-[280px] space-y-2">
          <p className="ui-section-label">Herramientas</p>
          <button type="button" className="ui-popover-action" onClick={() => togglePanel("tasks")}>
            <span>Tareas del equipo</span>
            {pendingTasksCount > 0 ? <span className="ui-badge ui-badge--warn">{pendingTasksCount}</span> : null}
          </button>
          <button type="button" className="ui-popover-action" onClick={() => togglePanel("chat")}>
            <span>Chat interno</span>
            {unreadChatCount > 0 ? <span className="ui-badge ui-badge--info">{unreadChatCount}</span> : null}
          </button>
        </div>
      ) : null}

      {activePanel === "support" ? (
        <div className="ui-card absolute right-6 top-[calc(100%+8px)] z-40 w-full max-w-[460px] space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Soporte</p>
            <p className="text-xs text-slate-500">
              Envía sugerencias o reportes de fallas con los datos necesarios para ayudarte.
            </p>
          </div>

          {supportWhatsappUrl ? (
            <a
              className="ui-btn-primary justify-center text-xs"
              href={supportWhatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              Contactar por WhatsApp
            </a>
          ) : null}

          <label className="block text-xs text-slate-500" htmlFor="support-type">
            Tipo
          </label>
          <select
            id="support-type"
            className="ui-input"
            value={supportType}
            onChange={(event) => setSupportType(event.target.value as SupportType)}
          >
            <option value="sugerencia">Sugerencia</option>
            <option value="falla">Reporte de falla</option>
          </select>

          <label className="block text-xs text-slate-500" htmlFor="support-subject">
            Asunto
          </label>
          <input
            id="support-subject"
            className="ui-input"
            value={supportSubject}
            onChange={(event) => setSupportSubject(event.target.value)}
            placeholder="Resumen corto"
          />

          <label className="block text-xs text-slate-500" htmlFor="support-message">
            Detalle
          </label>
          <textarea
            id="support-message"
            className="ui-input min-h-28"
            value={supportMessage}
            onChange={(event) => setSupportMessage(event.target.value)}
            placeholder="Describe la sugerencia o la falla"
          />

          <div className="flex justify-end gap-2">
            <button type="button" className="ui-btn-ghost" onClick={() => setActivePanel(null)}>
              Cerrar
            </button>
            <button type="button" className="ui-btn-primary" onClick={() => void submitSupport()} disabled={isSendingSupport}>
              {isSendingSupport ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : null}

      {activePanel === "tasks" ? (
        <div className="ui-card absolute right-6 top-[calc(100%+8px)] z-40 w-full max-w-[560px] space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Tareas del equipo</p>
            <p className="text-xs text-slate-500">Crea tareas y delégalas entre usuarios del comercio.</p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="ui-input"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Titulo"
            />
            <select
              className="ui-input"
              value={taskAssigneeId}
              onChange={(event) => setTaskAssigneeId(event.target.value)}
            >
              <option value="">Asignar a...</option>
              {usersForAssignments.map((item) => (
                <option key={item.id} value={item.id}>
                  {getDisplayName({ fullName: item.full_name, username: item.username, email: item.email })}
                </option>
              ))}
            </select>
          </div>

          <textarea
            className="ui-input min-h-24"
            value={taskDescription}
            onChange={(event) => setTaskDescription(event.target.value)}
            placeholder="Descripcion de la tarea"
          />

          <div className="flex justify-end">
            <button type="button" className="ui-btn-primary" onClick={createTask}>
              Crear tarea
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {tasksAssignedToMe.length === 0 ? (
              <div className="ui-empty-state">No tienes tareas asignadas.</div>
            ) : (
              tasksAssignedToMe.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="text-xs text-slate-500">Asignada por {task.assignedByLabel}</p>
                    </div>
                    <span className={task.status === "pendiente" ? "ui-badge ui-badge--warn" : "ui-badge ui-badge--success"}>
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{task.description}</p>
                  <div className="mt-2 flex justify-end">
                    <button type="button" className="ui-btn-ghost text-xs" onClick={() => toggleTaskStatus(task.id)}>
                      {task.status === "pendiente" ? "Marcar completada" : "Reabrir"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activePanel === "chat" ? (
        <div className="ui-card absolute right-6 top-[calc(100%+8px)] z-40 w-full max-w-[620px] space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Chat interno</p>
            <p className="text-xs text-slate-500">Comunicate con usuarios del sistema y revisa lectura/conexion.</p>
          </div>

          <select
            className="ui-input"
            value={chatRecipientId}
            onChange={(event) => setChatRecipientId(event.target.value)}
          >
            <option value="">Selecciona un usuario...</option>
            {usersForAssignments
              .filter((item) => item.id !== currentUserId)
              .map((item) => {
                const label = getDisplayName({
                  fullName: item.full_name,
                  username: item.username,
                  email: item.email,
                });
                const online = isUserOnline(item.id);

                return (
                  <option key={item.id} value={item.id}>
                    {`${label} (${online ? "conectado" : "desconectado"})`}
                  </option>
                );
              })}
          </select>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {!chatRecipient ? (
              <p className="text-xs text-slate-500">Elige un usuario para iniciar la conversacion.</p>
            ) : currentConversation.length === 0 ? (
              <p className="text-xs text-slate-500">Todavia no hay mensajes en esta conversacion.</p>
            ) : (
              currentConversation.map((message) => {
                const isMine = message.senderId === currentUserId;
                const isRead = message.readByUserIds.includes(chatRecipientId);

                return (
                  <div
                    key={message.id}
                    className={`rounded-lg border p-2 text-xs ${
                      isMine ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="font-semibold text-slate-900">{isMine ? "Tu" : message.senderLabel}</p>
                    <p className="mt-1 text-slate-700">{message.body}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {new Date(message.createdAt).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                      {isMine ? ` · ${isRead ? "leido" : "enviado"}` : ""}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              className="ui-input"
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              placeholder="Escribe un mensaje"
            />
            <button type="button" className="ui-btn-primary" onClick={sendChatMessage}>
              Enviar
            </button>
          </div>
        </div>
      ) : null}

      {activePanel === "notifications" ? (
        <div className="ui-card absolute right-6 top-[calc(100%+8px)] z-40 w-full max-w-[460px] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
            <span className="ui-badge ui-badge--info">Total: {notificationCount}</span>
          </div>

          <section className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">Alertas de stock</p>
              <span className="ui-badge ui-badge--warn">{lowStockProducts.length}</span>
            </div>

            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-slate-500">Sin alertas de stock por el momento.</p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs">
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-slate-700">
                      Stock: {product.stock_current}
                      {typeof product.stock_min === "number" ? ` · Minimo: ${product.stock_min}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                className="ui-btn-ghost text-xs"
                onClick={() => {
                  navigate(routePaths.stock);
                  setActivePanel(null);
                }}
              >
                Ver modulo Stock
              </button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-900">Consultas abiertas</p>
              <span className="ui-badge ui-badge--info">{openSupportTickets.length}</span>
            </div>
            {unreadSupportCount > 0 ? (
              <p className="text-xs text-emerald-700">Tienes {unreadSupportCount} respuesta(s) sin leer en soporte.</p>
            ) : null}

            {openSupportTickets.length === 0 ? (
              <p className="text-xs text-slate-500">No tienes consultas abiertas actualmente.</p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {openSupportTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                    <p className="font-semibold text-slate-900">{ticket.subject}</p>
                    <p className="text-slate-500">
                      {ticket.type === "falla" ? "Reporte de falla" : "Sugerencia"} · Estado: {ticket.status}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                className="ui-btn-primary text-xs"
                onClick={() => {
                  navigate(routePaths.misConsultas);
                  setActivePanel(null);
                }}
              >
                Ir a Mis consultas
              </button>
            </div>
          </section>

          {isSupportProfile ? (
            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Bandeja de soporte</p>
                <span className="ui-badge ui-badge--warn">{supportInboxCount}</span>
              </div>
              <p className="text-xs text-slate-500">
                Vista global para responder consultas de usuarios desde el sistema.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="ui-btn-primary text-xs"
                  onClick={() => {
                    navigate(routePaths.centroSoporte);
                    setActivePanel(null);
                  }}
                >
                  Ir a Centro soporte
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {activePanel === "user" ? (
        <div className="ui-card absolute right-6 top-[calc(100%+8px)] z-40 w-full max-w-[360px] space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.fullName ?? "Invitado"}</p>
            <p className="text-xs text-slate-500">{user?.email ?? "sin-sesion@local"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={connectionBadgeClass}>{connectionLabel}</span>
            {totalPendingCount > 0 ? <span className="ui-badge ui-badge--info">Pendientes: {totalPendingCount}</span> : null}
            {isInstalled ? <span className="ui-badge ui-badge--info">App instalada</span> : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                clearSyncError();
                void syncNow();
              }}
              className="ui-btn-ghost text-xs"
              disabled={!isOnline || isSyncing || totalPendingCount === 0}
            >
              <RefreshCw aria-hidden="true" className={isSyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {lastSyncError ? "Reintentar sync" : "Sincronizar"}
            </button>

            {isInstallSupported && canInstall ? (
              <button
                type="button"
                onClick={() => {
                  void installApp().then((accepted) => {
                    if (accepted) {
                      toast.success("App instalada");
                    }
                  });
                }}
                className="ui-btn-ghost text-xs"
                disabled={isInstalling}
              >
                {isInstalling ? "Instalando..." : "Instalar app"}
              </button>
            ) : (
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs text-slate-500">
                Instalacion no disponible
              </div>
            )}

            <button type="button" onClick={toggleTheme} className="ui-btn-ghost text-xs">
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>

            <button
              type="button"
              onClick={() => {
                void authService.signOut();
                clearSession();
                navigate(routePaths.login, { replace: true });
              }}
              className="ui-btn-ghost text-xs"
            >
              Salir
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
};
