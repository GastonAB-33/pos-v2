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

  try {
    const payload: OnboardTrialRequest = await req.json();
    const { businessName, fullName, email, phone, category, password, selectedPlanName, leadId } = payload;

    if (!businessName || !fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nombre de comercio, titular, email y contraseña son obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    let baseSlug = normalizeSlug(businessName);
    if (!baseSlug) baseSlug = `comercio-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Verificar si el slug ya existe, si es así agregar sufijo numérico
    const { data: existingTenants } = await serviceClient
      .from("tenants")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    let finalSlug = baseSlug;
    if (existingTenants && existingTenants.length > 0) {
      finalSlug = `${baseSlug}-${existingTenants.length + 1}`;
    }

    // 2. Crear o reutilizar usuario en Supabase Auth
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
        const matchedAuthUser = listData?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === cleanEmail
        );
        if (!matchedAuthUser) {
          return new Response(
            JSON.stringify({ error: `El email ya está registrado pero no se pudo recuperar: ${authError.message}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        authUserId = matchedAuthUser.id;
        // Actualizar contraseña y metadata para la nueva prueba
        await serviceClient.auth.admin.updateUserById(authUserId, {
          password: password,
          user_metadata: {
            full_name: fullName.trim(),
            business_name: businessName.trim(),
            role: "admin",
          },
        });
        // Limpiar filas anteriores de public.users vinculadas a este authUserId
        await serviceClient.from("users").delete().eq("auth_user_id", authUserId);
      } else {
        return new Response(
          JSON.stringify({ error: `Error creando credenciales: ${authError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      authUserId = authData.user.id;
    }

    // 3. Crear el Tenant
    const tenantId = `tenant-${finalSlug}`;
    const randomCuitSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const tempCuit = `30-${randomCuitSuffix}-0`;

    const { error: tenantError } = await serviceClient.from("tenants").insert({
      id: tenantId,
      legal_name: businessName.trim(),
      trade_name: businessName.trim(),
      slug: finalSlug,
      cuit: tempCuit,
      is_active: true,
    });

    if (tenantError) {
      return new Response(
        JSON.stringify({ error: `Error creando comercio: ${tenantError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Crear configuración del comercio (tenant_settings)
    await serviceClient.from("tenant_settings").insert({
      tenant_id: tenantId,
      allow_negative_stock: false,
      require_open_session_for_sale: false,
      scale_enabled: false,
      scale_mode: "total_price",
      scale_prefix: "20",
    });

    // 5. Crear perfil de permisos Admin completo
    const adminProfileId = `profile-admin-${finalSlug}`;
    const adminPermissions: Record<string, { read: boolean; write: boolean }> = {};
    for (const mod of ALL_SYSTEM_MODULES) {
      adminPermissions[mod] = { read: true, write: true };
    }

    await serviceClient.from("permission_profiles").insert({
      id: adminProfileId,
      tenant_id: tenantId,
      name: "Administrador General",
      description: "Perfil completo de administración",
      is_active: true,
      permissions: adminPermissions,
    });

    // 6. Crear el registro en public.users
    const userId = `user-${finalSlug}-admin`;
    const username = cleanEmail.split("@")[0] || "admin";
    const { error: userError } = await serviceClient.from("users").insert({
      id: userId,
      tenant_id: tenantId,
      auth_user_id: authUserId,
      email: cleanEmail,
      username: username,
      full_name: fullName.trim(),
      role_code: "admin",
      permission_profile_id: adminProfileId,
      is_active: true,
    });

    if (userError) {
      console.error("Error creando public.users:", userError);
      return new Response(
        JSON.stringify({ error: `Error asociando usuario administrador: ${userError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Medios de pago iniciales estándar
    await serviceClient.from("payment_methods").insert([
      {
        tenant_id: tenantId,
        code: "EFECTIVO",
        name: "Efectivo",
        type: "cash",
        affects_cash: true,
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
      {
        tenant_id: tenantId,
        code: "DEBITO",
        name: "Tarjeta Débito",
        type: "card_debit",
        affects_cash: false,
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
      {
        tenant_id: tenantId,
        code: "TRANSFERENCIA",
        name: "Transferencia / QR",
        type: "transfer",
        affects_cash: false,
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
      {
        tenant_id: tenantId,
        code: "CUENTA_CORRIENTE",
        name: "Cuenta Corriente",
        type: "current_account",
        affects_cash: false,
        is_active: true,
        surcharge_percent: 0,
        discount_percent: 0,
      },
    ]);

    // 8. Si vino un leadId de CRM o encontramos el lead por email, actualizar su etapa a 'trial'
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

    // 9. Responder con éxito y datos de acceso directo
    const trialDays = 7;
    const now = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

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
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
