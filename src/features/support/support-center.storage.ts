import { storageKeys } from "@/utils/local-storage";

export type SupportTicketType = "sugerencia" | "falla";
export type SupportTicketStatus = "abierta" | "en_proceso" | "esperando_usuario" | "cerrada";
export type SupportAuthorRole = "usuario" | "soporte";

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
  tenantId: string;
  type: SupportTicketType;
  subject: string;
  status: SupportTicketStatus;
  requesterUserId: string;
  requesterLabel: string;
  requesterEmail: string | null;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

type SeenByUserMap = Record<string, string>;

interface CreateTicketInput {
  tenantId: string;
  type: SupportTicketType;
  subject: string;
  body: string;
  requesterUserId: string;
  requesterLabel: string;
  requesterEmail: string | null;
}

interface AppendMessageInput {
  ticketId: string;
  authorId: string;
  authorLabel: string;
  authorRole: SupportAuthorRole;
  body: string;
}

const readJsonArray = <T,>(key: string): T[] => {
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

const writeJsonArray = <T,>(key: string, rows: T[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Evitar romper el flujo si falla localStorage.
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
      tenantId: input.tenantId,
      type: input.type,
      subject: trimToMaxLength(input.subject, 160),
      status: "abierta",
      requesterUserId: input.requesterUserId,
      requesterLabel: input.requesterLabel,
      requesterEmail: input.requesterEmail,
      createdAt,
      updatedAt: createdAt,
      messages: [],
    };

    message.ticketId = ticket.id;
    ticket.messages = [message];

    const all = readJsonArray<SupportTicket>(storageKeys.supportTickets);
    all.unshift(ticket);
    writeJsonArray(storageKeys.supportTickets, all);
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

    const nextStatus =
      input.authorRole === "usuario" && ticket.status === "esperando_usuario" ? "abierta" : ticket.status;

    const updated: SupportTicket = {
      ...ticket,
      status: nextStatus,
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
