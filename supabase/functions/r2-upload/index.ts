import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAuthenticatedTenantUser } from "../_shared/admin.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const ALLOWED_FOLDERS = new Set(["productos", "tienda", "comprobantes"]);
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const sha256Hex = async (data: Uint8Array | string): Promise<string> => {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(hash);
};

const hmacSha256 = async (key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
};

const getSigningKey = async (
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> => {
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
};

const signR2Request = async (params: {
  method: "PUT" | "DELETE";
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType?: string;
  cacheControl?: string;
}): Promise<Response> => {
  const host = `${params.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${params.bucket}/${params.key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")}`;
  const url = `https://${host}${canonicalUri}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";

  const payloadHash = await sha256Hex(params.body);

  const headersToSign: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (params.contentType) {
    headersToSign["content-type"] = params.contentType;
  }
  if (params.cacheControl) {
    headersToSign["cache-control"] = params.cacheControl;
  }

  const sortedHeaderKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headersToSign[k]}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    params.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await getSigningKey(params.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchHeaders: Record<string, string> = {
    Authorization: authorizationHeader,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (params.contentType) fetchHeaders["Content-Type"] = params.contentType;
  if (params.cacheControl) fetchHeaders["Cache-Control"] = params.cacheControl;

  return fetch(url, {
    method: params.method,
    headers: fetchHeaders,
    body: params.method === "PUT" ? params.body : undefined,
  });
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binaryString = atob(clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Método no permitido" }, 405);
  }

  try {
    // 1. Autenticar usuario y extraer tenant_id real desde Postgres (anti-BOLA/IDOR)
    const caller = await requireAuthenticatedTenantUser(req.headers.get("Authorization"));

    // 2. Verificar credenciales de Cloudflare R2 en secretos del servidor
    const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
    const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "jireh-pos-products";
    const publicBaseUrl = (Deno.env.get("R2_PUBLIC_URL") ?? "https://cdn.jireh.cloud").replace(/\/$/, "");

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return jsonResponse(
        { success: false, error: "Credenciales R2 no configuradas en Edge Function" },
        503
      );
    }

    const body = (await req.json()) as {
      action?: "upload" | "delete";
      folder?: string;
      contentType?: string;
      base64Data?: string;
      publicUrl?: string;
    };

    const action = body.action ?? "upload";

    if (action === "delete") {
      const targetUrl = (body.publicUrl ?? "").trim();
      const expectedPrefix = `${publicBaseUrl}/comercios/${caller.tenantId}/`;
      if (!targetUrl.startsWith(expectedPrefix)) {
        return jsonResponse(
          { success: false, error: "No tenés permiso para eliminar este recurso" },
          403
        );
      }

      const key = targetUrl.slice(publicBaseUrl.length + 1);
      const r2Res = await signR2Request({
        method: "DELETE",
        accountId,
        accessKeyId,
        secretAccessKey,
        bucket,
        key,
        body: new Uint8Array(0),
      });

      if (!r2Res.ok && r2Res.status !== 404) {
        return jsonResponse(
          { success: false, error: `Error eliminando en R2 (${r2Res.status})` },
          502
        );
      }

      return jsonResponse({ success: true, deletedKey: key });
    }

    // Acción UPLOAD
    const folder = (body.folder ?? "productos").trim();
    if (!ALLOWED_FOLDERS.has(folder)) {
      return jsonResponse({ success: false, error: "Carpeta de destino inválida" }, 400);
    }

    const contentType = (body.contentType ?? "image/webp").trim().toLowerCase();
    const ext = ALLOWED_MIME_TYPES[contentType];
    if (!ext) {
      return jsonResponse({ success: false, error: "Tipo de archivo no permitido" }, 400);
    }

    if (!body.base64Data) {
      return jsonResponse({ success: false, error: "Archivo vacío o faltante" }, 400);
    }

    const fileBytes = base64ToUint8Array(body.base64Data);
    if (fileBytes.byteLength === 0 || fileBytes.byteLength > MAX_FILE_BYTES) {
      return jsonResponse(
        { success: false, error: "El archivo supera el límite permitido de 5 MB" },
        400
      );
    }

    const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `comercios/${caller.tenantId}/${folder}/${uniqueId}.${ext}`;

    const r2Res = await signR2Request({
      method: "PUT",
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      key,
      body: fileBytes,
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    });

    if (!r2Res.ok) {
      const errText = await r2Res.text().catch(() => "");
      return jsonResponse(
        { success: false, error: `Error subiendo a R2 (${r2Res.status}): ${errText}` },
        502
      );
    }

    const publicUrl = `${publicBaseUrl}/${key}`;
    return jsonResponse({ success: true, publicUrl, key });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado en r2-upload";
    const status = message.includes("Sesion") || message.includes("permisos") ? 401 : 500;
    return jsonResponse({ success: false, error: message }, status);
  }
});
