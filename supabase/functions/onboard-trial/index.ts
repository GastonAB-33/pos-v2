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
}

const normalizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: OnboardTrialRequest = await req.json();
    const { businessName, fullName, email, phone, category, password, selectedPlanName } = payload;

    if (!businessName || !fullName || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Nombre de comercio, titular, email y contraseña son obligatorios." }),
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

    // 2. Crear usuario en Supabase Auth
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
      return new Response(
        JSON.stringify({ error: `Error creando credenciales: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUserId = authData.user.id;
    const now = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // 3. Crear el Tenant con 7 días de prueba
    const tenantId = `tenant-${finalSlug}`;
    const { error: tenantError } = await serviceClient.from("tenants").insert({
      id: tenantId,
      legal_name: businessName.trim(),
      trade_name: businessName.trim(),
      slug: finalSlug,
      cuit: "30-00000000-0",
      is_active: true,
      subscription_status: "trial",
      trial_ends_at: trialEndsAt.toISOString(),
      plan_id: "formalizando",
      mrr_amount: 40000.00,
      notes: `Rubro: ${category || "General"} | Teléfono: ${phone}`,
    });

    if (tenantError) {
      // Revertir auth si falla tenant
      await serviceClient.auth.admin.deleteUser(authUserId);
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

    // 5. Crear perfil de permisos Admin y Vendedor
    const adminProfileId = `profile-admin-${finalSlug}`;
    await serviceClient.from("permission_profiles").insert([
      {
        id: adminProfileId,
        tenant_id: tenantId,
        name: "Administrador General",
        is_system: true,
        permissions: {
          ventas: { read: true, write: true },
          pos: { read: true, write: true },
          stock: { read: true, write: true },
          caja: { read: true, write: true },
          clientes: { read: true, write: true },
          proveedores: { read: true, write: true },
          compras: { read: true, write: true },
          bancos: { read: true, write: true },
          usuarios: { read: true, write: true },
          configuracion: { read: true, write: true },
          reportes: { read: true, write: true },
          facturacion: { read: true, write: true },
        },
      },
    ]);

    // 6. Crear el registro en public.users
    await serviceClient.from("users").insert({
      tenant_id: tenantId,
      auth_user_id: authUserId,
      email: cleanEmail,
      username: "admin",
      full_name: fullName.trim(),
      role: "admin",
      permission_profile_id: adminProfileId,
      is_active: true,
    });

    // 7. Medios de pago iniciales
    await serviceClient.from("payment_methods").insert([
      { tenant_id: tenantId, code: "EFECTIVO", name: "Efectivo", is_active: true },
      { tenant_id: tenantId, code: "DEBITO", name: "Tarjeta Débito", is_active: true },
      { tenant_id: tenantId, code: "TRANSFERENCIA", name: "Transferencia / QR", is_active: true },
      { tenant_id: tenantId, code: "CUENTA_CORRIENTE", name: "Cuenta Corriente", is_active: true },
    ]);

    // 8. Crear la caja principal inicial
    await serviceClient.from("cash_registers").insert({
      tenant_id: tenantId,
      name: "Caja Principal",
      code: "CAJA-01",
      is_active: true,
    });

    // 9. Registrar el Lead en el CRM
    await serviceClient.from("crm_leads").insert({
      tenant_id: tenantId,
      business_name: businessName.trim(),
      contact_name: fullName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      category: category || "Almacén y Kiosco",
      stage: "trial",
      selected_plan: selectedPlanName || 'Plan "Me Estoy Formalizando"',
      estimated_mrr: 40000.00,
      source: "landing_page",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    });

    // 10. Responder con éxito y datos de acceso directo
    return new Response(
      JSON.stringify({
        success: true,
        tenantId,
        tenantSlug: finalSlug,
        email: cleanEmail,
        trialEndsAt: trialEndsAt.toISOString(),
        loginPath: `/${finalSlug}/login`,
        message: "Comercio creado y 7 días de prueba activados exitosamente.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
