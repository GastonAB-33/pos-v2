import { auditService } from "@/services/audit.service";
import { storageKeys } from "@/utils/local-storage";

export type SupportTicketType = "falla" | "sugerencia" | "consulta";
export type SupportTicketStatus = "abierta" | "en_proceso" | "esperando_usuario" | "cerrada";
export type SupportAuthorRole = "usuario" | "soporte";

export interface SupportDeviceInfo {
  browser: string;
  os: string;
  resolution: string;
  isMobile: boolean;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  createdAt: string;
  authorId: string;
  authorLabel: string;
  authorRole: SupportAuthorRole;
  body: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: number;
  tenantId: string;
  tenantName: string;
  type: SupportTicketType;
  subject: string;
  status: SupportTicketStatus;
  requesterUserId: string;
  requesterLabel: string;
  requesterRole: string;
  requesterEmail: string | null;
  moduleName: string;
  routePath: string;
  deviceInfo: SupportDeviceInfo;
  screenshotDataUrl: string | null;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

type SeenByUserMap = Record<string, string>;

export interface CreateTicketInput {
  tenantId: string;
  tenantName?: string;
  type: SupportTicketType;
  subject: string;
  body: string;
  requesterUserId: string;
  requesterLabel: string;
  requesterRole?: string;
  requesterEmail: string | null;
  moduleName?: string;
  routePath?: string;
  deviceInfo?: SupportDeviceInfo;
  screenshotDataUrl?: string | null;
}

export interface AppendMessageInput {
  ticketId: string;
  authorId: string;
  authorLabel: string;
  authorRole: SupportAuthorRole;
  body: string;
}

const isOversizedScreenshot = (dataUrl: string | null | undefined): boolean => {
  if (!dataUrl) return false;
  // Si la captura supera los 250KB en base64, es un PNG antiguo no comprimido
  return dataUrl.length > 250_000;
};

const sanitizeTickets = (tickets: SupportTicket[]): SupportTicket[] => {
  return tickets.map((t, idx) => {
    // Mantener captura solo en los 10 tickets más recientes y si no es gigante
    if (t.screenshotDataUrl && (idx >= 10 || isOversizedScreenshot(t.screenshotDataUrl))) {
      return { ...t, screenshotDataUrl: null };
    }
    return t;
  });
};

const readJsonArray = <T,>(key: string): T[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    if (key === storageKeys.supportTickets) {
      const sanitized = sanitizeTickets(parsed as SupportTicket[]);
      return sanitized as unknown as T[];
    }

    return parsed as T[];
  } catch {
    return [];
  }
};

const writeJsonArray = <T,>(key: string, rows: T[]) => {
  if (typeof window === "undefined") return;

  const trySave = (data: unknown[]): boolean => {
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent("support-tickets-updated"));
      return true;
    } catch {
      return false;
    }
  };

  // 1. Intentar guardado directo
  if (trySave(rows)) return;

  // 2. Si falla por cuota, limpiar capturas gigantes o antiguas
  if (key === storageKeys.supportTickets && Array.isArray(rows)) {
    let tickets = sanitizeTickets(rows as SupportTicket[]);
    if (trySave(tickets)) return;

    // 3. Si aún excede, conservar capturas solo en los 3 más recientes
    tickets = tickets.map((t, idx) => (idx > 2 ? { ...t, screenshotDataUrl: null } : t));
    if (trySave(tickets)) return;

    // 4. Si aún excede, quitar todas las capturas para no perder el texto de los tickets
    tickets = tickets.map((t) => ({ ...t, screenshotDataUrl: null }));
    if (trySave(tickets)) return;

    // 5. Último recurso: limitar a los últimos 30 tickets sin capturas
    tickets = tickets.slice(0, 30);
    trySave(tickets);
  }
};

const readSeenMap = (): SeenByUserMap => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(storageKeys.supportSeenByUser);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;

    return parsed && typeof parsed === "object" ? (parsed as SeenByUserMap) : {};
  } catch {
    return {};
  }
};

const writeSeenMap = (map: SeenByUserMap) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKeys.supportSeenByUser, JSON.stringify(map));
  } catch {
    // Evitar romper el flujo si falla localStorage.
  }
};

const sortByUpdatedDesc = (rows: SupportTicket[]) =>
  [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const getSeenMapKey = (tenantId: string, userId: string) => `${tenantId}:${userId}`;

const trimToMaxLength = (value: string, maxLength: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trim();
};

export const getNextTicketNumber = (existingTickets: SupportTicket[]): number => {
  if (!existingTickets.length) return 1001;
  const maxNumber = existingTickets.reduce((max, t) => (t.ticketNumber > max ? t.ticketNumber : max), 1000);
  return maxNumber + 1;
};

export const detectDeviceInfo = (): SupportDeviceInfo => {
  if (typeof window === "undefined") {
    return {
      browser: "Desconocido",
      os: "Desconocido",
      resolution: "0x0",
      isMobile: false,
    };
  }

  const ua = navigator.userAgent;
  let browser = "Navegador Web";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Google Chrome";
  else if (ua.includes("Edg")) browser = "Microsoft Edge";
  else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";

  let os = "Sistema Operativo";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";

  const width = window.innerWidth || window.screen?.width || 0;
  const height = window.innerHeight || window.screen?.height || 0;
  const isMobile = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  return {
    browser,
    os,
    resolution: `${width}x${height}`,
    isMobile,
  };
};

export const formatWhatsAppSupportMessage = (ticket: SupportTicket): string => {
  const lines = [
    `🚨 *REPORTE DE SOPORTE #${ticket.ticketNumber}*`,
    ``,
    `🏢 *Comercio:* ${ticket.tenantName || "Comercio"}`,
    `📍 *Módulo:* ${ticket.moduleName}`,
    ``,
    `📝 *Asunto:* ${ticket.subject}`,
    `💬 *Detalle:*`,
    ticket.messages[0]?.body || ticket.subject,
  ];

  return lines.join("\n");
};

export const supportCenterStorage = {
  getAll: (): SupportTicket[] => sortByUpdatedDesc(readJsonArray<SupportTicket>(storageKeys.supportTickets)),

  getByTenant: (tenantId: string): SupportTicket[] =>
    supportCenterStorage.getAll().filter((ticket) => ticket.tenantId === tenantId),

  getOpenByTenant: (tenantId: string): SupportTicket[] =>
    supportCenterStorage.getByTenant(tenantId).filter((ticket) => ticket.status !== "cerrada"),

  getOpenByTenantForUser: (tenantId: string, userId: string): SupportTicket[] =>
    supportCenterStorage
      .getByTenant(tenantId)
      .filter((ticket) => ticket.requesterUserId === userId && ticket.status !== "cerrada"),

  createTicket: (input: CreateTicketInput): SupportTicket => {
    const createdAt = new Date().toISOString();
    const all = readJsonArray<SupportTicket>(storageKeys.supportTickets);
    const ticketNumber = getNextTicketNumber(all);

    const message: SupportTicketMessage = {
      id: crypto.randomUUID(),
      ticketId: "",
      createdAt,
      authorId: input.requesterUserId,
      authorLabel: input.requesterLabel,
      authorRole: "usuario",
      body: trimToMaxLength(input.body, 5000),
    };

    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      ticketNumber,
      tenantId: input.tenantId,
      tenantName: input.tenantName || "Comercio",
      type: input.type,
      subject: trimToMaxLength(input.subject, 160),
      status: "abierta",
      requesterUserId: input.requesterUserId,
      requesterLabel: input.requesterLabel,
      requesterRole: input.requesterRole || "Usuario",
      requesterEmail: input.requesterEmail,
      moduleName: input.moduleName || "Sistema POS",
      routePath: input.routePath || "/",
      deviceInfo: input.deviceInfo || detectDeviceInfo(),
      screenshotDataUrl: input.screenshotDataUrl || null,
      createdAt,
      updatedAt: createdAt,
      messages: [],
    };

    message.ticketId = ticket.id;
    ticket.messages = [message];

    all.unshift(ticket);
    writeJsonArray(storageKeys.supportTickets, all);

    // Registro seguro en auditoría / nube
    try {
      void auditService.createSafe(input.tenantId, {
        user_id: input.requesterUserId,
        module: "soporte",
        action: "ticket_creado",
        entity_type: "support_ticket",
        entity_id: ticket.id,
        description: `Ticket #${ticket.ticketNumber} [${ticket.type}]: ${ticket.subject}`,
        metadata: {
          ticketNumber: ticket.ticketNumber,
          type: ticket.type,
          subject: ticket.subject,
          moduleName: ticket.moduleName,
          requesterLabel: ticket.requesterLabel,
          requesterEmail: ticket.requesterEmail,
          status: ticket.status,
          createdAt,
          messages: ticket.messages,
        },
      });
    } catch {
      // safe
    }

    return ticket;
  },

  appendMessage: (input: AppendMessageInput): SupportTicket | null => {
    const body = trimToMaxLength(input.body, 5000);
    if (!body) return null;

    const now = new Date().toISOString();
    const all = readJsonArray<SupportTicket>(storageKeys.supportTickets);
    const index = all.findIndex((ticket) => ticket.id === input.ticketId);
    if (index < 0) return null;

    const ticket = all[index];
    const message: SupportTicketMessage = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      createdAt: now,
      authorId: input.authorId,
      authorLabel: input.authorLabel,
      authorRole: input.authorRole,
      body,
    };

    const updated: SupportTicket = {
      ...ticket,
      updatedAt: now,
      messages: [...ticket.messages, message],
    };

    all[index] = updated;
    writeJsonArray(storageKeys.supportTickets, all);
    return updated;
  },

  updateStatus: (ticketId: string, status: SupportTicketStatus): SupportTicket | null => {
    const now = new Date().toISOString();
    const all = readJsonArray<SupportTicket>(storageKeys.supportTickets);
    const index = all.findIndex((ticket) => ticket.id === ticketId);
    if (index < 0) return null;

    const updated: SupportTicket = {
      ...all[index],
      status,
      updatedAt: now,
    };

    all[index] = updated;
    writeJsonArray(storageKeys.supportTickets, all);
    return updated;
  },

  updateAdminNotes: (ticketId: string, adminNotes: string): SupportTicket | null => {
    const now = new Date().toISOString();
    const all = readJsonArray<SupportTicket>(storageKeys.supportTickets);
    const index = all.findIndex((ticket) => ticket.id === ticketId);
    if (index < 0) return null;

    const updated: SupportTicket = {
      ...all[index],
      adminNotes,
      updatedAt: now,
    };

    all[index] = updated;
    writeJsonArray(storageKeys.supportTickets, all);
    return updated;
  },

  markSeenForUser: (tenantId: string, userId: string) => {
    const map = readSeenMap();
    map[getSeenMapKey(tenantId, userId)] = new Date().toISOString();
    writeSeenMap(map);
  },

  getUnreadCountForUser: (tenantId: string, userId: string): number => {
    const map = readSeenMap();
    const seenAt = map[getSeenMapKey(tenantId, userId)] ?? null;
    const seenTime = seenAt ? new Date(seenAt).getTime() : 0;

    const tickets = supportCenterStorage.getOpenByTenantForUser(tenantId, userId);
    return tickets.reduce((count, ticket) => {
      const latestMessage = ticket.messages[ticket.messages.length - 1];
      if (!latestMessage) return count;
      if (latestMessage.authorId === userId) return count;
      if (new Date(latestMessage.createdAt).getTime() <= seenTime) return count;
      return count + 1;
    }, 0);
  },
};
