---
name: pos-security-shield
description: >-
  Standard and operational playbook for full cybersecurity audits, hardening, and compliance across POS V2:
  secret management, BaaS & tenant RLS isolation, AI provider edge isolation, HTTP security headers,
  rate limiting, input sanitization, error telemetry with PII masking, and the 35-point legal & privacy checklist.
---

# POS V2 - Manual y Estándar de Ciberseguridad, Protección de Datos y Blindaje (Security Shield)

Este estándar consolida el marco integral de ciberseguridad, defensa en profundidad, protección perimetral y cumplimiento legal para todo el ecosistema de **POS V2** (Aplicación Principal POS, CRM Admin, Landing Page y Supabase Edge Functions / Base de Datos).

---

## 1. Gestión Segura de Secretos y Prevención de Fugas

### 1.1. Canales Críticos de Filtración a Neutralizar
1. **Historial de Git inmutable**:
   - Eliminar un archivo `.env` en un commit posterior no mitiga una filtración; cualquier bot o usuario puede clonar el árbol histórico.
   - Todo archivo que contenga credenciales debe estar estrictamente ignorado en `.gitignore` (`.env`, `.env.*`, excepto `!.env.example`).
   - Si una clave toma contacto con el repositorio, debe considerarse **comprometida de inmediato** y someterse al protocolo de rotación y revocación ante el proveedor (Supabase, OpenAI, ARCA, Mercado Pago).
2. **Compilación involuntaria en el cliente (Frontend Bundling)**:
   - Los empaquetadores como Vite incrustan cualquier variable con prefijo `VITE_` directamente en el código JavaScript compilado que se entrega al navegador.
   - **Regla inquebrantable**: Jamás declarar claves secretas de API (OpenAI, Anthropic, Gemini), claves de firma privada (certificados ARCA/AFIP), `SUPABASE_SERVICE_ROLE_KEY` ni PINs maestros de administración con prefijo `VITE_`.
3. **Compromiso en entornos locales y paquetes npm maliciosos**:
   - Evitar almacenar secretos de producción en texto claro en estaciones de trabajo locales.
   - Usar inyección en memoria en runtime mediante gestores centralizados (Doppler, Infisical, OpenBao) o variables de entorno en la nube de Vercel y Supabase.
4. **Comunicaciones no seguras**:
   - Prohibido compartir credenciales, claves ARCA o certificados por mensajería instantánea (WhatsApp, Slack, email) sin cifrado asimétrico o bóvedas seguras (1Password, Bitwarden).

### 1.2. Barreras Estáticas y Escaneo Pre-Commit
- Implementar escáneres estáticos de secretos en hooks locales (`pre-commit` y `pre-push`) mediante **Gitleaks** o **TruffleHog**:
  ```bash
  # Escaneo local de repositorio con Gitleaks
  gitleaks detect --source . --verbose
  ```
- Bloquear commits que contengan patrones de JWTs de servicio, claves RSA (`BEGIN RSA PRIVATE KEY`), tokens de proveedores de IA o cadenas de conexión a base de datos.

---

## 2. Vectores de Riesgo en Desarrollo Asistido por IA ("Vibe Coding")

### 2.1. La Falacia Funcional y Omisión de Row Level Security (RLS)
- Las herramientas asistidas por IA generan interfaces y endpoints que funcionan visualmente de inmediato, pero suelen obviar la seguridad perimetral de la base de datos.
- En BaaS como Supabase, la clave anónima (`anon key`) es pública y visible en el navegador. Si las tablas no tienen RLS activado y configurado exhaustivamente:
  - Cualquier usuario puede extraer la URL y la `anon key` desde DevTools.
  - Puede ejecutar peticiones HTTP directas al endpoint PostgREST y descargar la totalidad de las tablas de todos los clientes (nombres, teléfonos, ventas, saldos).
- **Mandato**: Toda tabla en Supabase debe tener RLS habilitado y políticas restrictivas vinculadas a `auth.uid()` y `tenant_id`.

### 2.2. Aislamiento Estricto de APIs de Inteligencia Artificial (BFF Pattern)
- **Riesgo crítico**: Colocar `VITE_OPENAI_API_KEY` o `VITE_GEMINI_API_KEY` en el cliente para alimentar chatbots o reconocimiento de productos expone la clave privada a cualquier usuario, agotando cuotas y generando facturación fraudulenta.
- **Arquitectura obligatoria (Backend-for-Frontend / Edge Functions)**:
  1. El cliente web **nunca** llama a la API de IA de forma directa.
  2. El cliente envía la solicitud al backend/Edge Function autenticado (con JWT de usuario).
  3. El servidor valida la sesión, rol, cuota y rate-limiting.
  4. El servidor custodia la API Key en variable de entorno segura del backend y contacta al proveedor de IA.
  5. El servidor devuelve al cliente únicamente la respuesta procesada y depurada.

---

## 3. Blindaje de la Capa de Backend, Base de Datos y APIs

### 3.1. Políticas Obligatorias de Persistencia (Postgres / Supabase)
1. **Activación Universal de RLS**:
   - `alter table <tabla> enable row level security;` en el 100% de las tablas del esquema público.
   - Toda policy debe validar aislamiento multi-tenant estricto mediante la función:
     ```sql
     create policy "<tabla>_tenant_isolation"
     on public.<tabla>
     for all
     to authenticated
     using (tenant_id = public.current_tenant_id())
     with check (tenant_id = public.current_tenant_id());
     ```
2. **Separación de Roles**:
   - La clave `anon` sólo tiene acceso a operaciones controladas por RLS y rutas públicas estrictamente delimitadas.
   - La clave `service_role` jamás se compila en el frontend ni se expone al cliente; sólo se ejecuta dentro de Supabase Edge Functions seguras en servidor.
3. **Cifrado en Reposo de Datos Sensibles**:
   - Información crítica como certificados fiscales (claves privadas `.key` de ARCA), números de cuenta bancaria o secretos de integración no deben residir en texto plano en la base de datos.
   - Aplicar cifrado simétrico/asimétrico (ej. `pgcrypto` con llaves custodiadas en variables de entorno del servidor) antes de persistir.
4. **Parametrización Obligatoria de Consultas**:
   - Prohibida la concatenación directa de cadenas de texto para generar sentencias SQL.
   - Utilizar el builder parametrizado de PostgREST o sentencias preparadas con parámetros formales (`$1, $2, ...`) para neutralizar inyecciones SQL.
5. **Bloqueo de Manipulación de Campos (Mass Assignment)**:
   - Todo servicio de inserción o actualización debe implementar una lista blanca estricta de atributos modificables.
   - Descartar automáticamente campos no autorizados enviados por el cliente (`role`, `is_active`, `tenant_id`, `balance`, `current_account_balance`).
6. **Autenticación Verificada en Servidor**:
   - Las decisiones de autorización y acceso a recursos deben resolverse exclusivamente en el servidor mediante el JWT decodificado en Supabase Auth / Edge Functions.
   - Nunca confiar en flags, roles o booleanos almacenados en `localStorage` o `sessionStorage`.
7. **Minimización de Datos en Respuestas (Data Minimization)**:
   - Evitar `SELECT *` de forma genérica en entidades que contengan metadatos internos, configuraciones fiscales o identificadores de terceros.
   - Proyectar únicamente los campos requeridos por la vista del cliente.

---

## 4. Endurecimiento Perimetral, Capa Web y Defensa del Frontend

### 4.1. Cabeceras HTTP de Seguridad (Security Headers)
Configurar en `vercel.json` o proxy inverso las cabeceras defensivas para todo tráfico:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.supabase.co https://*.mercadopago.com; connect-src 'self' https://*.supabase.co https://api.mercadopago.com; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

### 4.2. Protección de Sesiones y Cookies
- Sustituir la persistencia pura en `localStorage` por almacenamiento de tokens protegido contra XSS o cookies con atributos:
  - `HttpOnly`: Impide lectura y exfiltración desde scripts maliciosos de JavaScript.
  - `Secure`: Fuerza transmisión exclusiva sobre HTTPS/TLS.
  - `SameSite=Lax` (o `Strict`): Previene ataques de falsificación de petición en sitios cruzados (CSRF).

### 4.3. Controles de Tráfico, Anti-Bot y Manejo de Archivos
1. **Rate Limiting en Autenticación y Formularios**:
   - Limitar intentos fallidos de login por IP e identificador de cuenta para frustrar fuerza bruta y credential stuffing.
   - Aplicar rate limiting estricto en Edge Functions públicas (`onboard-trial`, creación de usuarios).
2. **Protección Anti-Bot y Anti-Spam**:
   - Integrar Cloudflare Turnstile o honeypots no intrusivos en los formularios de registro y contacto de la landing page.
3. **Validación y Sanitización de Entradas**:
   - Toda entrada de usuario debe validarse con esquemas Zod rigurosos.
   - Sanitizar texto antes de renderizar para prevenir Cross-Site Scripting (XSS).
4. **Restricción de Subida de Archivos**:
   - Validar extensiones permitidas (`.webp`, `.jpg`, `.png`).
   - Inspeccionar los *magic bytes* / tipo MIME real del binario antes de procesar.
   - Enforzar cuotas de tamaño máximo (ej. 2MB por imagen de producto).
   - Servir archivos desde bucket de almacenamiento aislado sin permisos de ejecución de scripts.
5. **Escaneo Continuo de Dependencias**:
   - Ejecutar `npm audit` periódicamente y resolver paquetes vulnerables (especialmente librerías con historial de Prototype Pollution o ReDoS como `xlsx` y parseadores no mantenidos).

### 4.4. Higiene Técnica y Calidad
- Páginas de error 404 y 500 personalizadas y estilizadas, sin volcar stack traces ni versiones de servidor.
- Control de indexación con `public/robots.txt` y `public/sitemap.xml`.
- Metadatos visuales: Favicon, Open Graph (`og:title`, `og:image`, `og:description`) para compartir en redes.
- Contraste visual accesible conforme a las directivas de `dark-mode-contrast` y navegación completa por teclado con `agile-keyboard-flow`.

---

## 5. Observabilidad, Telemetría de Errores y Sesiones con Privacidad

### 5.1. Monitorización Proactiva de Excepciones (Sentry)
- Captura estructurada de errores en runtime tanto en cliente como en backend/edge functions.
- Registro de stack trace completo, contexto de la sesión, versión de compilación y componente causante.

### 5.2. Reproducción de Sesiones con Privacidad Desde el Diseño (PostHog)
- Si se incorporan herramientas de grabación de sesión de usuario:
  - Activar **enmascaramiento y difuminado automático** estricto (`maskAllInputs: true`, `maskTextSelector: ".sensitive-data"`).
  - Bloquear la captura de contraseñas, CUIT/CUIL, datos de tarjetas de crédito o credenciales de pago, saldos monetarios privados y notas confidenciales.

---

## 6. Lista de Control de 35 Puntos de Cumplimiento Normativo

### A. Gobernanza de Datos y Consentimiento
1. [ ] **Política de Privacidad formal**: Publicada, accesible y detallando datos recolectados, finalidad y base jurídica.
2. [ ] **Términos y Condiciones de uso**: Reglas operativas, responsabilidades y SLA accesibles a todos los usuarios.
3. [ ] **Banner de consentimiento de cookies**: Interfaz clara que bloquee rastreadores hasta aceptación explícita.
4. [ ] **Mecanismo de baja en comunicaciones**: Enlace funcional de *Unsubscribe* en correos transaccionales y de marketing.
5. [ ] **Período definido de retención**: Plazos claros de conservación y purga de logs y registros históricos.
6. [ ] **Derechos de acceso, descarga y borrado**: Procedimiento para exportar datos y dar de baja cuentas (Habeas Data / GDPR).
7. [ ] **Principio de minimización**: Solicitar estrictamente los datos imprescindibles para la operativa.
8. [ ] **Casillas de aceptación desmarcadas**: Obligar a la acción voluntaria del usuario (sin checkboxes pre-tildados).
9. [ ] **Consentimiento independiente para marketing**: Casilla separada de los términos obligatorios del servicio.
10. [ ] **Consentimiento para datos de menores**: Filtro de edad o autorización tutelar requerida.
11. [ ] **Registro inmutable de consentimiento**: Trazabilidad con timestamp e IP del momento de aceptación de términos.
12. [ ] **Prohibición de entrenamiento con datos de usuarios**: Compromiso explícito de no alimentar modelos de IA con datos del negocio sin consentimiento.
13. [ ] **Acuerdos de procesamiento de datos (DPA)**: DPA suscritos con proveedores de infraestructura (Supabase, Vercel, Resend).
14. [ ] **Publicación transparente de subprocesadores**: Listado público de proveedores tecnológicos terceros.
15. [ ] **Auditoría de librerías y SDKs de analítica**: Inspección de scripts de terceros para verificar qué datos transmiten.

### B. Transparencia Comercial y Erradicación de Patrones Engañosos
16. [ ] **Eliminación de cuentas regresivas artificiales**: Prohibido el uso de timers falsos para inducir urgencia.
17. [ ] **Supresión de interfaces engañosas (Dark Patterns)**: Flujos claros sin desvíos forzados de navegación.
18. [ ] **Política de reembolsos clara**: Criterios, plazos y medios de reembolso visibles antes de contratar.
19. [ ] **Equidad en el proceso de cancelación**: Cancelar la suscripción debe ser tan fácil como registrarse.
20. [ ] **Supresión de reseñas falsas**: Testimonios reales y contrastables de comercios clientes.
21. [ ] **Eliminación de declaraciones indemostrables**: Sin promesas infundadas de rendimiento o disponibilidad.
22. [ ] **Notificación previa de renovación automática**: Aviso preventivo antes de cobros recurrentes de tarjeta/débito.
23. [ ] **Eliminación de tarifas ocultas**: Mostrar el importe final completo sin recargos sorpresa al cobrar.
24. [ ] **Compromisos de disponibilidad realistas**: SLAs alcanzables acordes a la infraestructura real.
25. [ ] **Datos de contacto empresariales visibles**: Razón social, CUIT, domicilio y canales de atención accesibles.

### C. Accesibilidad, Propiedad Intelectual y Regulación de IA
26. [ ] **Contraste de color apropiado**: Ratios WCAG AA en modo claro, oscuro y midnight (`dark-mode-contrast`).
27. [ ] **Texto alternativo en recursos gráficos**: Etiquetas `alt` descriptivas en imágenes informativas.
28. [ ] **Navegación completa por teclado**: Toda la operativa usable sin ratón (`agile-keyboard-flow`).
29. [ ] **Uso autorizado de logotipos**: Consentimiento por escrito para exhibir marcas de aliados y clientes.
30. [ ] **Verificación de derechos sobre activos digitales**: Licencias válidas en tipografías, íconos y librerías.
31. [ ] **Etiquetado de contenido creado con IA**: Declarar transparentemente resultados generados por modelos de lenguaje o visión.
32. [ ] **Cumplimiento de licencias open source**: Respeto de licencias MIT/Apache/BSD y mención de créditos.
33. [ ] **Prohibición de certificaciones no verificables**: Prohibido exhibir insignias SOC 2, ISO u otras sin certificación oficial.
34. [ ] **Canal de atención de propiedad intelectual**: Vía de contacto para tramitar reclamos de derechos de autor.
35. [ ] **Revisión jurídica profesional**: Validación periódica de términos y contratos por asesor letrado.

---

## 7. Protocolo de Auditoría y Verificación Técnica de Salida

### 7.1. Matriz de Liberación Previa al Despliegue (Release Gate)
| Componente | Condición Obligatoria de Aprobación | Procedimiento de Comprobación |
| :--- | :--- | :--- |
| **Credenciales y Secretos** | Cero claves privadas en Git o bundle JS del cliente. | Escaneo con Gitleaks; auditoría de `dist/` buscando `VITE_` indebidos. |
| **Control de Base de Datos** | RLS activo y probado en el 100% de tablas. | Test de consulta con anon key verificando rechazo total de datos no propios. |
| **Integración con IA** | Claves de proveedores custodiadas en backend/Edge. | Inspección de red del navegador para confirmar que no se despachan claves privadas. |
| **Telemetría y Privacidad** | Excepciones monitoreadas y PII ofuscada. | Generación de error de prueba comprobando ofuscación en Sentry/PostHog. |
| **Gobernanza de Consentimiento** | Bloqueo activo de scripts de analítica previo a consentimiento. | Navegación privada verificando que no se expidan cookies no esenciales antes de aceptar. |

### 7.2. Simulación de Ataque Asistida por IA (Red Teaming)
Antes de publicar o promover cambios a producción, simular el rol de un atacante informático (*Red Teamer*):
1. **Auditoría de Políticas RLS**: Buscar tablas nuevas o migradas donde se haya omitido `ENABLE ROW LEVEL SECURITY` o cuyas cláusulas `using` utilicen columnas inconsistentes (ej. `role` vs `role_code`).
2. **Inspección de Asignación Masiva**: Enviar payloads con propiedades extras en formularios de actualización para verificar si el backend o base de datos los procesa o los descarta.
3. **Fugas en Endpoints**: Comprobar si las Edge Functions devuelven respuestas con campos confidenciales innecesarios o si omiten la validación del JWT de sesión en el encabezado `Authorization`.
