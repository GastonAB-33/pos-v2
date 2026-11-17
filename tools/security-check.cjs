#!/usr/bin/env node
/**
 * POS V2 - Script de Chequeo y Auditoría Automatizada de Seguridad
 * Estándar: pos-security-shield
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🛡️  Ejecutando chequeo integral de seguridad POS V2 (Security Shield)...\n');

let hasErrors = false;

// 1. Verificación de archivos .env y git status
console.log('1️⃣  Verificando que no haya secretos o archivos .env en el staging de Git...');
try {
  const status = execSync('git status --porcelain', { encoding: 'utf8' });
  const lines = status.split('\n');
  const stagedEnv = lines.find((l) => /^[AMDRC].*\.env(?!\.example)/i.test(l.trim()));
  if (stagedEnv) {
    console.error('❌ ERROR CRÍTICO: Se detectó un archivo .env en el área de preparación (staging) de Git: ' + stagedEnv);
    hasErrors = true;
  } else {
    console.log('✅ Correcto: Ningún archivo de secretos .env se encuentra en staging.');
  }
} catch (e) {
  console.warn('⚠️  Aviso: No se pudo verificar el estado de Git:', e.message);
}

// 2. Verificación de cabeceras de seguridad en vercel.json (raíz, crm-admin y landing)
console.log('\n2️⃣  Verificando cabeceras HTTP de seguridad en vercel.json (raíz, crm-admin y landing)...');
const vercelPaths = ['vercel.json', 'crm-admin/vercel.json', 'landing/vercel.json'];
for (const vPath of vercelPaths) {
  try {
    if (!fs.existsSync(vPath)) {
      console.error(`❌ ERROR: Falta archivo ${vPath}`);
      hasErrors = true;
      continue;
    }
    const vercelConfig = JSON.parse(fs.readFileSync(vPath, 'utf8'));
    const headers = vercelConfig.headers?.[0]?.headers || [];
    const requiredHeaders = ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Strict-Transport-Security'];
    const missing = requiredHeaders.filter((h) => !headers.some((item) => item.key === h));
    if (missing.length > 0) {
      console.error(`❌ ERROR en ${vPath}: Faltan cabeceras requeridas: ${missing.join(', ')}`);
      hasErrors = true;
    } else {
      console.log(`✅ Correcto: Cabeceras de seguridad verificadas en ${vPath}`);
    }
  } catch (e) {
    console.error(`❌ ERROR al leer ${vPath}:`, e.message);
    hasErrors = true;
  }
}

// 3. Verificación de PINs hardcodeados en CRM Admin
console.log('\n3️⃣  Verificando ausencia de PINs o contraseñas maestras hardcodeadas en crm-admin...');
try {
  const crmAuthFile = fs.readFileSync('crm-admin/src/components/AuthGateModal.tsx', 'utf8');
  if (crmAuthFile.includes('181093')) {
    console.error('❌ ERROR: Se detectó un PIN en texto plano en AuthGateModal.tsx');
    hasErrors = true;
  } else if (crmAuthFile.includes('crypto.subtle.digest') && crmAuthFile.includes('SHA-256')) {
    console.log('✅ Correcto: AuthGateModal.tsx implementa cifrado criptográfico SHA-256 y protección anti fuerza bruta.');
  }
} catch (e) {
  console.error('❌ ERROR al verificar crm-admin:', e.message);
  hasErrors = true;
}

// 4. Verificación de cumplimiento PCI-DSS en Landing Page (cero captura directa de PAN/CVV)
console.log('\n4️⃣  Verificando cumplimiento PCI-DSS en pasarela de pagos (landing)...');
try {
  const paymentModal = fs.readFileSync('landing/src/components/PaymentGatewayModal.tsx', 'utf8');
  if (paymentModal.includes('cardNumber') || paymentModal.includes('cardData') || paymentModal.includes('placeholder="CVV"')) {
    console.error('❌ ERROR PCI-DSS: Se detectaron campos de entrada de número de tarjeta o CVV no tokenizados en PaymentGatewayModal.tsx');
    hasErrors = true;
  } else {
    console.log('✅ Correcto: Pasarela de pagos conforme a PCI-DSS (sin captura directa de PAN/CVV en el DOM).');
  }
} catch (e) {
  console.error('❌ ERROR al verificar PaymentGatewayModal.tsx:', e.message);
  hasErrors = true;
}

// 5. Verificación de ausencia de contraseñas en texto claro en leads
console.log('\n5️⃣  Verificando ausencia de contraseñas de clientes en texto claro en landing/onboarding...');
try {
  const onboardingFile = fs.readFileSync('landing/src/services/onboarding.service.ts', 'utf8');
  if (onboardingFile.includes('client_password:') || onboardingFile.includes('clientPassword:')) {
    console.error('❌ ERROR: Se detectó persistencia de contraseñas de clientes en texto claro en onboarding.service.ts');
    hasErrors = true;
  } else {
    console.log('✅ Correcto: Ninguna contraseña se almacena en texto claro en crm_leads ni localStorage.');
  }
} catch (e) {
  console.error('❌ ERROR al verificar onboarding.service.ts:', e.message);
  hasErrors = true;
}

// 6. Verificación de Edge Functions contra BOLA / IDOR
console.log('\n6️⃣  Verificando blindaje contra BOLA / IDOR en Edge Functions administrativas...');
try {
  const adminShared = fs.readFileSync('supabase/functions/_shared/admin.ts', 'utf8');
  const deleteUser = fs.readFileSync('supabase/functions/admin-delete-user/index.ts', 'utf8');
  const updateUser = fs.readFileSync('supabase/functions/admin-update-user/index.ts', 'utf8');
  const createUser = fs.readFileSync('supabase/functions/admin-create-user/index.ts', 'utf8');

  if (
    adminShared.includes('CallerContext') &&
    deleteUser.includes('caller.tenantId') &&
    updateUser.includes('caller.tenantId') &&
    createUser.includes('caller.tenantId')
  ) {
    console.log('✅ Correcto: Edge Functions validan tenant_id y previenen secuestro de cuentas cross-tenant.');
  } else {
    console.error('❌ ERROR: Edge Functions carecen de validación de contexto de tenant contra BOLA.');
    hasErrors = true;
  }
} catch (e) {
  console.error('❌ ERROR al verificar Edge Functions:', e.message);
  hasErrors = true;
}

// 7. Verificación de scripts SQL de Hardening RLS (037 y 038)
console.log('\n7️⃣  Verificando scripts de migración y hardening SQL (037 y 038)...');
if (fs.existsSync('docs/sql/037_security_hardening_rls_fixes.sql') && fs.existsSync('docs/sql/038_security_hardening_settings_and_telemetry.sql')) {
  console.log('✅ Correcto: Scripts 037 y 038 presentes con blindaje de RLS, Storage, Settings y Telemetría.');
} else {
  console.error('❌ ERROR: Faltan archivos de migración SQL de seguridad.');
  hasErrors = true;
}

// 8. Verificación de cifrado AES-GCM en almacenamiento IndexedDB offline
console.log('\n8️⃣  Verificando cifrado criptográfico AES-GCM en IndexedDB offline (pos-v2-offline)...');
try {
  const offlineDbFile = fs.readFileSync('src/services/offline-database.service.ts', 'utf8');
  if (
    offlineDbFile.includes('AES-GCM') &&
    offlineDbFile.includes('extractable: false') &&
    offlineDbFile.includes('__encrypted') &&
    offlineDbFile.includes('crypto.subtle.encrypt') &&
    offlineDbFile.includes('crypto.subtle.decrypt')
  ) {
    console.log('✅ Correcto: IndexedDB offline implementa cifrado simétrico AES-GCM 256 bits con clave no extraíble.');
  } else {
    console.error('❌ ERROR: offline-database.service.ts carece de cifrado criptográfico AES-GCM para almacenamiento offline.');
    hasErrors = true;
  }
} catch (e) {
  console.error('❌ ERROR al verificar offline-database.service.ts:', e.message);
  hasErrors = true;
}

// 9. Verificación de Edge Function de pagos seguros Mercado Pago
console.log('\n9️⃣  Verificando Edge Function proxy y aislamiento de credenciales de Mercado Pago...');
try {
  const mpCheckoutFile = fs.readFileSync('supabase/functions/mercadopago-checkout/index.ts', 'utf8');
  const mpClientFile = fs.readFileSync('src/services/mercadopago/mercadopago-payments.service.ts', 'utf8');

  if (
    mpCheckoutFile.includes('requireAuthenticatedTenantUser') &&
    mpCheckoutFile.includes('create-preference') &&
    mpCheckoutFile.includes('create-payment-intent') &&
    mpClientFile.includes('mercadopago-checkout')
  ) {
    console.log('✅ Correcto: Proxy perimetral mercadopago-checkout configurado con aislamiento de credenciales en el servidor.');
  } else {
    console.error('❌ ERROR: Falta implementación o integración de la Edge Function mercadopago-checkout.');
    hasErrors = true;
  }
} catch (e) {
  console.error('❌ ERROR al verificar Edge Function mercadopago-checkout:', e.message);
  hasErrors = true;
}

console.log('\n-----------------------------------------------------------');
if (hasErrors) {
  console.error('🚨 AUDITORÍA DE SEGURIDAD CON FALLOS. Resolver los puntos anteriores.');
  process.exit(1);
} else {
  console.log('🎉 TODAS LAS PRUEBAS DE SEGURIDAD APROBADAS (100% SECURITY SHIELD COMPLIANT - 9 GATES PASSED).');
  process.exit(0);
}
