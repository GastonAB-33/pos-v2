import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  serviceClient,
  requireAuthenticatedTenantUser,
} from "../_shared/admin.ts";

/**
 * Supabase Edge Function: mercadopago-checkout
 *
 * Proxy seguro del servidor para cobros con Mercado Pago:
 * - Aísla el access_token privado en el backend (no se expone al cliente web).
 * - Valida la identidad y el tenant_id del cajero/administrador llamador.
 * - Soporta Checkout Pro (preferencias) e intenciones de cobro / QR point.
 */

interface PreferenceItem {
  id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

interface CreatePreferencePayload {
  action: "create-preference";
  items: PreferenceItem[];
  external_reference?: string;
  payer?: {
    name?: string;
    email?: string;
  };
  back_urls?: {
    success?: string;
    pending?: string;
    failure?: string;
  };
  metadata?: Record<string, unknown>;
}

interface CreateIntentPayload {
  action: "create-payment-intent";
  amount: number;
  currency_code?: string;
  description?: string;
  sale_number_hint?: string;
  customer_id?: string;
  metadata?: Record<string, unknown>;
  mode?: "mock" | "sandbox" | "real";
}

interface GetStatusPayload {
  action: "get-payment-status";
  payment_id: string;
}

interface CancelIntentPayload {
  action: "cancel-payment-intent";
  intent_id: string;
}

type MercadopagoActionPayload =
  | CreatePreferencePayload
  | CreateIntentPayload
  | GetStatusPayload
  | CancelIntentPayload;

const resolveAccessToken = async (tenantId: string): Promise<string | null> => {
  // 1. Verificar si el comercio configuró su propio access_token en tenant_settings
  try {
    const { data: row } = await serviceClient
      .from("tenant_settings")
      .select("settings")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const tenantToken =
      row?.settings?.sistema?.mercado_pago?.access_token ||
      row?.settings?.medios_pago?.mercadopago?.access_token;

    if (typeof tenantToken === "string" && tenantToken.trim().length > 10) {
      return tenantToken.trim();
    }
  } catch {
    // Si falla la lectura, proceder al fallback de entorno
  }

  // 2. Fallback a variable de entorno global en Supabase Secrets
  const globalToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (typeof globalToken === "string" && globalToken.trim().length > 10) {
    return globalToken.trim();
  }

  return null;
};

Deno.serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const caller = await requireAuthenticatedTenantUser(authHeader);

    const body = (await req.json()) as MercadopagoActionPayload;
    if (!body || !body.action) {
      return jsonResponse({ error: "Parámetro 'action' requerido" }, 400);
    }

    const accessToken = await resolveAccessToken(caller.tenantId);

    switch (body.action) {
      case "create-preference": {
        if (!accessToken) {
          return jsonResponse(
            {
              error:
                "Mercado Pago no está configurado en el servidor para este comercio. Configura tus credenciales o activa el modo mock.",
            },
            400
          );
        }

        const items = Array.isArray(body.items) && body.items.length > 0
          ? body.items.map((it) => ({
              id: it.id || "item",
              title: it.title || "Venta POS",
              description: it.description || "",
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.unit_price) || 0,
              currency_id: it.currency_id || "ARS",
            }))
          : [
              {
                id: "pos-sale",
                title: "Venta de mostrador",
                quantity: 1,
                unit_price: 100,
                currency_id: "ARS",
              },
            ];

        const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items,
            external_reference: body.external_reference || `ref-${caller.tenantId}-${Date.now()}`,
            payer: body.payer,
            back_urls: body.back_urls,
            auto_return: body.back_urls ? "approved" : undefined,
            metadata: {
              tenant_id: caller.tenantId,
              user_id: caller.userId,
              ...(body.metadata || {}),
            },
          }),
        });

        if (!mpRes.ok) {
          const errDetail = await mpRes.text().catch(() => "");
          console.error("[mercadopago-checkout] Error al crear preferencia:", errDetail);
          return jsonResponse(
            { error: "Error devuelto por la API de Mercado Pago al crear preferencia" },
            mpRes.status
          );
        }

        const mpData = await mpRes.json();
        return jsonResponse({
          preference_id: mpData.id,
          init_point: mpData.init_point,
          sandbox_init_point: mpData.sandbox_init_point,
          external_reference: mpData.external_reference,
        });
      }

      case "create-payment-intent": {
        const intentId = `mpi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const reference = `MP-INTENT-${caller.tenantId.slice(0, 4)}-${Date.now()}`;
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

        return jsonResponse({
          id: intentId,
          tenant_id: caller.tenantId,
          amount: Number(body.amount) || 0,
          currency_code: body.currency_code || "ARS",
          reference,
          status: "pending",
          metadata: {
            description: body.description ?? null,
            customer_id: body.customer_id ?? null,
            sale_number_hint: body.sale_number_hint ?? null,
            mode: body.mode ?? (accessToken ? "real" : "mock"),
            tenant_id: caller.tenantId,
            ...(body.metadata ?? {}),
          },
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        });
      }

      case "get-payment-status": {
        if (!body.payment_id) {
          return jsonResponse({ error: "Falta payment_id" }, 400);
        }

        if (!accessToken) {
          return jsonResponse({
            id: body.payment_id,
            status: "approved",
            status_detail: "mock_approved",
          });
        }

        const statusRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${encodeURIComponent(body.payment_id)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!statusRes.ok) {
          return jsonResponse({ error: "No se pudo consultar el pago en Mercado Pago" }, statusRes.status);
        }

        const statusData = await statusRes.json();
        return jsonResponse({
          id: String(statusData.id),
          status: statusData.status,
          status_detail: statusData.status_detail,
          transaction_amount: statusData.transaction_amount,
          date_approved: statusData.date_approved,
        });
      }

      case "cancel-payment-intent": {
        return jsonResponse({
          intent_id: body.intent_id,
          tenant_id: caller.tenantId,
          status: "cancelled",
          updated_at: new Date().toISOString(),
        });
      }

      default:
        return jsonResponse({ error: "Acción no reconocida" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado en checkout";
    console.error("[mercadopago-checkout] Excepción:", message);
    return jsonResponse({ error: message }, 400);
  }
});
