import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/admin.ts";

interface OnboardTrialRequest {
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  category?: string;
  password?: string;
  selectedPlanName?: string;
  leadId?: string;
  // Campos Honeypot anti-bot (deben venir vacíos desde formularios humanos)
  hp_company?: string;
  website?: string;
}

// Rate Limiter en memoria para mitigación anti-abuso / anti-bot
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count += 1;
  return false;
}

const normalizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ALL_SYSTEM_MODULES = [
  "dashboard",
  "pos",
  "productos",
  "clientes",
  "cuentas_corrientes",
  "stock",
  "caja",
  "compras",
  "proveedores",
  "listas_precios",
  "promociones",
  "medios_pago",
  "facturacion",
  "comprobantes",
  "reportes",
  "auditoria",
  "configuracion",
  "configuracion_agenda",
  "configuracion_catalogo",
  "configuracion_analisis",
  "configuracion_sistema",
  "configuracion_contable",
  "usuarios",
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Obtener IP y aplicar Rate Limiting defensivo
  const clientIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-origin";

  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({
        error: "Has superado el límite de intentos de registro. Por seguridad, aguardá unos minutos antes de reintentar.",
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "900" } }
    );
  }

  try {
    const payload: OnboardTrialRequest = await req.json();
    const { businessName, fullName, email, phone, category, password, selectedPlanName, leadId, hp_company, website } = payload;

    // 2. Trampa anti-bot (Honeypot): Si un bot automatizado llena campos invisibles, descartar silenciosamente
    if (hp_company || website) {
      console.warn(`[Security Alert] Bot detectado en onboard-trial desde IP: ${clientIp}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Solicitud procesada correctamente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validación y saneamiento de entradas
    if (!businessName || !fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nombre de comercio, titular, email y contraseña son obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6 || password.length > 72) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener entre 6 y 72 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (businessName.length > 100 || fullName.length > 100 || email.length > 150) {
      return new Response(
        JSON.stringify({ error: "Uno o más campos exceden la longitud máxima permitida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    let baseSlug = normalizeSlug(businessName);
    if (!baseSlug) baseSlug = `comercio-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Verificar si el slug ya existe, si es así agregar sufijo numérico
    const { data: existingTenants } = await serviceClient
      .from("tenants")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    let finalSlug = baseSlug;
    if (existingTenants && existingTenants.length > 0) {
      finalSlug = `${baseSlug}-${existingTenants.length + 1}`;
    }

    // 5. Crear o reutilizar usuario en Supabase Auth
    let authUserId = "";
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        role: "admin",
      },
    });

    if (authError) {
      const msg = authError.message?.toLowerCase() || "";
      const isAlreadyRegistered =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        (authError as { code?: string }).code === "email_exists";

      if (isAlreadyRegistered) {
        const { data: listData } = await serviceClient.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(
          (u) => u.email?.toLowerCase() === cleanEmail
        );
        if (existingAuthUser) {
          authUserId = existingAuthUser.id;
          await serviceClient.auth.admin.updateUserById(authUserId, {
            password: password,
            email_confirm: true,
          });
        } else {
          return new Response(
            JSON.stringify({ error: "Este correo ya está registrado en la plataforma. Iniciá sesión con tus credenciales." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: `Error en autenticación: ${authError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (authData?.user) {
      authUserId = authData.user.id;
    }

    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: "No se pudo vincular la cuenta de usuario." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Crear el registro en public.tenants con 7 días de prueba
    const trialDays = 7;
    const now = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const { data: tenantData, error: tenantError } = await serviceClient
      .from("tenants")
      .insert({
        name: businessName.trim(),
        slug: finalSlug,
        email: cleanEmail,
        phone: phone ? phone.trim() : null,
        is_active: true,
        plan: selectedPlanName || "trial",
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select("id")
      .single();

    if (tenantError || !tenantData) {
      return new Response(
        JSON.stringify({ error: `Error al crear el comercio: ${tenantError?.message || "Error desconocido"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = tenantData.id;

    // 7. Crear perfil de permisos completo 'Administrador'
    const fullPermissions = ALL_SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod] = { read: true, write: true };
      return acc;
    }, {} as Record<string, { read: boolean; write: boolean }>);

    const { data: profileData, error: profileError } = await serviceClient
      .from("permission_profiles")
      .insert({
        tenant_id: tenantId,
        name: "Administrador General",
        description: "Acceso total a todos los módulos del sistema",
        permissions: fullPermissions,
        is_active: true,
      })
      .select("id")
      .single();

    if (profileError || !profileData) {
      console.warn("No se pudo crear perfil de permisos personalizado:", profileError?.message);
    }

    const permissionProfileId = profileData?.id || null;

    // 8. Crear o vincular el registro en public.users
    const usernameBase = cleanEmail.split("@")[0].replace(/[^a-z0-9]/g, "");
    const username = `${usernameBase}-${finalSlug.slice(0, 6)}`;

    const { error: userError } = await serviceClient.from("users").upsert(
      {
        tenant_id: tenantId,
        auth_user_id: authUserId,
        email: cleanEmail,
        username: username,
        full_name: fullName.trim(),
        role_code: "admin",
        permission_profile_id: permissionProfileId,
        is_active: true,
      },
      { onConflict: "auth_user_id" }
    );

    if (userError) {
      console.warn("Aviso al vincular public.users:", userError.message);
    }

    // 9. Crear medios de pago básicos predeterminados
    await serviceClient.from("payment_methods").insert([
      {
        tenant_id: tenantId,
        code: "cash",
        name: "Efectivo",
        type: "cash",
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
      {
        tenant_id: tenantId,
        code: "debit",
        name: "Tarjeta de Débito",
        type: "card",
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
      {
        tenant_id: tenantId,
        code: "transfer",
        name: "Transferencia Bancaria",
        type: "transfer",
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
    ]);

    // 10. Si vino un leadId de CRM o encontramos el lead por email, actualizar su etapa a 'trial'
    const targetLeadId = leadId;
    if (targetLeadId) {
      await serviceClient
        .from("crm_leads")
        .update({
          stage: "trial",
          tenant_id: tenantId,
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .eq("id", targetLeadId);
    } else {
      await serviceClient
        .from("crm_leads")
        .update({
          stage: "trial",
          tenant_id: tenantId,
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
        })
        .eq("email", cleanEmail);
    }

    // 11. Responder con éxito y datos de acceso directo
    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        tenantSlug: finalSlug,
        email: cleanEmail,
        trialEndsAt: trialEndsAt.toISOString(),
        loginPath: `/${finalSlug}/login?email=${encodeURIComponent(cleanEmail)}`,
        message: "Comercio creado y 7 días de prueba activados exitosamente.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error en onboard-trial:", errorMsg);
    // Error genérico para no filtrar detalles técnicos internos
    return new Response(
      JSON.stringify({ error: "Ocurrió un error al procesar el alta de la prueba. Por favor contactá a soporte." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
