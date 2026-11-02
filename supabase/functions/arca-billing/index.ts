import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
// @ts-ignore: Deno npm import
import forge from "npm:node-forge@1.3.1";

/**
 * Supabase Edge Function: arca-billing
 * Comunicación directa con Web Services de ARCA (ex AFIP):
 * - WSAA (Web Services Autenticación y Autorización): LoginCms con PKCS#7
 * - WSFE (Facturación Electrónica v1): FEDummy, FECompUltimoAutorizado, FECAESolicitar
 */

interface ArcaRequestPayload {
  action: "test-connection" | "get-last-voucher" | "create-invoice" | "create-credit-note";
  mode?: "mock" | "sandbox" | "real";
  fiscal_environment?: "homologacion" | "produccion";
  punto_venta: number;
  cuit_emisor: string;
  certificate_crt?: string;
  certificate_key?: string;
  document_type?: "A" | "B" | "C" | "PRESUPUESTO";
  subtotal?: number;
  tax_total?: number;
  total?: number;
  receiver_doc_type?: string | null;
  receiver_doc_number?: string | null;
  associated_voucher?: {
    tipo: number;
    punto_venta: number;
    numero: number;
    cuit?: string;
  };
}

const WSAA_URLS = {
  sandbox: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  real: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
};

const WSFE_URLS = {
  sandbox: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  real: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
};

// Códigos AFIP
const CBTE_INVOICE_CODES: Record<string, number> = {
  A: 1,
  B: 6,
  C: 11,
};

const CBTE_CREDIT_NOTE_CODES: Record<string, number> = {
  A: 3,
  B: 8,
  C: 13,
};

// Caché en memoria para Token y Sign de WSAA (válidos por 12 horas)
interface CachedToken {
  token: string;
  sign: string;
  expiresAt: number; // timestamp ms
}
const tokenCache = new Map<string, CachedToken>();

/**
 * Formatea fecha en ISO 8601 con offset Argentina (-03:00)
 */
function toArgentinaIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = -3;
  const localDate = new Date(date.getTime() + offset * 60 * 60 * 1000);
  const y = localDate.getUTCFullYear();
  const m = pad(localDate.getUTCMonth() + 1);
  const d = pad(localDate.getUTCDate());
  const h = pad(localDate.getUTCHours());
  const min = pad(localDate.getUTCMinutes());
  const s = pad(localDate.getUTCSeconds());
  return `${y}-${m}-${d}T${h}:${min}:${s}-03:00`;
}

/**
 * Firma el TRA (Ticket de Requerimiento de Acceso) con PKCS#7 / CMS
 */
function signTraXml(traXml: string, certPem: string, keyPem: string): string {
  const pki = forge.pki;
  const cert = pki.certificateFromPem(certPem);
  
  let privateKey;
  try {
    privateKey = pki.privateKeyFromPem(keyPem);
  } catch {
    // Si la clave tiene formato alternativo o encrypted
    privateKey = pki.decryptRsaPrivateKey(keyPem);
  }

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data,
      },
      {
        type: forge.pki.oids.messageDigest,
      },
      {
        type: forge.pki.oids.signingTime,
        value: new Date(),
      },
    ],
  });

  p7.sign();
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

/**
 * Autentica ante el WSAA de ARCA y obtiene Token y Sign
 */
async function getWsaaAuth(
  env: "sandbox" | "real",
  cuit: string,
  certPem: string,
  keyPem: string
): Promise<{ token: string; sign: string }> {
  const cacheKey = `${env}_${cuit}`;
  const now = Date.now();
  const cached = tokenCache.get(cacheKey);

  // Reusar ticket si aún le quedan más de 10 minutos de validez
  if (cached && cached.expiresAt > now + 10 * 60 * 1000) {
    return { token: cached.token, sign: cached.sign };
  }

  const wsaaUrl = env === "real" ? WSAA_URLS.real : WSAA_URLS.sandbox;

  // AFIP recomienda un TRA generado 10 minutos en el pasado para tolerar desviaciones de reloj
  const genTime = toArgentinaIso(new Date(now - 10 * 60 * 1000));
  const expTime = toArgentinaIso(new Date(now + 10 * 60 * 1000));
  const uniqueId = Math.floor(now / 1000);

  const traXml = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${genTime}</generationTime>
    <expirationTime>${expTime}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;

  const cmsB64 = signTraXml(traXml, certPem, keyPem);

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsB64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(wsaaUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: soapEnvelope,
  });

  const responseXml = await response.text();

  if (!response.ok || responseXml.includes("<faultstring>")) {
    const faultMatch = responseXml.match(/<faultstring>(.*?)<\/faultstring>/);
    const faultMsg = faultMatch ? faultMatch[1] : `HTTP ${response.status}`;
    throw new Error(`WSAA Rechazó la autenticación: ${faultMsg}`);
  }

  // Extraer loginCmsReturn (desescapando entidades XML si vienen codificadas)
  const unescapedXml = responseXml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

  const tokenMatch = unescapedXml.match(/<token>(.*?)<\/token>/i);
  const signMatch = unescapedXml.match(/<sign>(.*?)<\/sign>/i);
  const expMatch = unescapedXml.match(/<expirationTime>(.*?)<\/expirationTime>/i);

  if (!tokenMatch || !signMatch) {
    throw new Error("WSAA no devolvió token o sign válidos.");
  }

  const token = tokenMatch[1];
  const sign = signMatch[1];
  const expiresAt = expMatch ? new Date(expMatch[1]).getTime() : now + 11 * 3600 * 1000;

  tokenCache.set(cacheKey, { token, sign, expiresAt });
  return { token, sign };
}

/**
 * Verifica estado de servidores WSFE con FEDummy
 */
async function callFeDummy(endpointUrl: string): Promise<{
  appServer: string;
  dbServer: string;
  authServer: string;
}> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FEDummy xmlns="http://ar.gov.afip.dif.FEV1/" />
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FEDummy",
    },
    body: soapEnvelope,
  });

  const xmlText = await response.text();
  const appServerMatch = xmlText.match(/<AppServer>(.*?)<\/AppServer>/);
  const dbServerMatch = xmlText.match(/<DbServer>(.*?)<\/DbServer>/);
  const authServerMatch = xmlText.match(/<AuthServer>(.*?)<\/AuthServer>/);

  return {
    appServer: appServerMatch ? appServerMatch[1] : "UNKNOWN",
    dbServer: dbServerMatch ? dbServerMatch[1] : "UNKNOWN",
    authServer: authServerMatch ? authServerMatch[1] : "UNKNOWN",
  };
}

/**
 * Consulta el último comprobante emitido ante ARCA con FECompUltimoAutorizado
 */
async function getUltimoComprobante(
  wsfeUrl: string,
  auth: { token: string; sign: string },
  cuit: string,
  puntoVenta: number,
  cbteTipo: number
): Promise<number> {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECompUltimoAutorizado xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${auth.token}</Token>
        <Sign>${auth.sign}</Sign>
        <Cuit>${cuit}</Cuit>
      </Auth>
      <PtoVta>${puntoVenta}</PtoVta>
      <CbteTipo>${cbteTipo}</CbteTipo>
    </FECompUltimoAutorizado>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(wsfeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
    },
    body: soapEnvelope,
  });

  const xmlText = await response.text();
  const nroMatch = xmlText.match(/<CbteNro>(.*?)<\/CbteNro>/);
  if (nroMatch) {
    return parseInt(nroMatch[1], 10) || 0;
  }
  return 0;
}

/**
 * Solicita CAE ante ARCA con FECAESolicitar
 */
async function solicitarCae(params: {
  wsfeUrl: string;
  auth: { token: string; sign: string };
  cuit: string;
  puntoVenta: number;
  cbteTipo: number;
  nextVoucherNumber: number;
  subtotal: number;
  taxTotal: number;
  total: number;
  receiverDocType?: string | null;
  receiverDocNumber?: string | null;
  associatedVoucher?: {
    tipo: number;
    punto_venta: number;
    numero: number;
    cuit?: string;
  };
}): Promise<{
  cae: string;
  caeDueDate: string;
  voucherNumber: number;
}> {
  const today = new Date();
  const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");

  // Determinación de tipo de documento receptor
  const cleanReceiverDoc = (params.receiverDocNumber || "").replace(/\D/g, "");
  let docTipo = 99; // Sin identificar / Consumidor Final
  let docNro = "0";

  if (cleanReceiverDoc.length === 11) {
    docTipo = 80; // CUIT
    docNro = cleanReceiverDoc;
  } else if (cleanReceiverDoc.length === 8 || cleanReceiverDoc.length === 7) {
    docTipo = 96; // DNI
    docNro = cleanReceiverDoc;
  }

  const isFacturaC = params.cbteTipo === 11 || params.cbteTipo === 12 || params.cbteTipo === 13;
  let impTotal = Number(params.total.toFixed(2));
  let impNeto = 0;
  let impIva = 0;
  let ivaXml = "";

  if (isFacturaC) {
    // Factura C (Monotributo): no discrimina IVA, todo es neto/total sin bloque IVA
    impNeto = impTotal;
    impIva = 0;
    ivaXml = "";
  } else {
    // Factura A o B (Responsable Inscripto): IVA es OBLIGATORIO si hay importe neto
    if (params.taxTotal && params.taxTotal > 0) {
      impIva = Number(params.taxTotal.toFixed(2));
      impNeto = Number((impTotal - impIva).toFixed(2));
    } else {
      // Si el POS o venta registró el importe final con IVA incluido (21% estándar)
      impNeto = Number((impTotal / 1.21).toFixed(2));
      impIva = Number((impTotal - impNeto).toFixed(2));
    }

    // Asegurar que impTotal coincida exactamente con la suma
    impTotal = Number((impNeto + impIva).toFixed(2));

    ivaXml = `<Iva>
      <AlicIva>
        <Id>5</Id>
        <BaseImp>${impNeto.toFixed(2)}</BaseImp>
        <Importe>${impIva.toFixed(2)}</Importe>
      </AlicIva>
    </Iva>`;
  }

  // Bloque Comprobantes Asociados (para Notas de Crédito)
  let cbtesAsocXml = "";
  if (params.associatedVoucher) {
    cbtesAsocXml = `<CbtesAsoc>
      <CbteAsoc>
        <Tipo>${params.associatedVoucher.tipo}</Tipo>
        <PtoVta>${params.associatedVoucher.punto_venta}</PtoVta>
        <Nro>${params.associatedVoucher.numero}</Nro>
        <Cuit>${params.associatedVoucher.cuit || params.cuit}</Cuit>
      </CbteAsoc>
    </CbtesAsoc>`;
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <FECAESolicitar xmlns="http://ar.gov.afip.dif.FEV1/">
      <Auth>
        <Token>${params.auth.token}</Token>
        <Sign>${params.auth.sign}</Sign>
        <Cuit>${params.cuit}</Cuit>
      </Auth>
      <FeCAEReq>
        <FeCabReq>
          <CantReg>1</CantReg>
          <PtoVta>${params.puntoVenta}</PtoVta>
          <CbteTipo>${params.cbteTipo}</CbteTipo>
        </FeCabReq>
        <FeDetReq>
          <FECAEDetRequest>
            <Concepto>1</Concepto>
            <DocTipo>${docTipo}</DocTipo>
            <DocNro>${docNro}</DocNro>
            <CbteDesde>${params.nextVoucherNumber}</CbteDesde>
            <CbteHasta>${params.nextVoucherNumber}</CbteHasta>
            <CbteFch>${yyyymmdd}</CbteFch>
            <ImpTotal>${impTotal.toFixed(2)}</ImpTotal>
            <ImpTotConc>0</ImpTotConc>
            <ImpNeto>${impNeto.toFixed(2)}</ImpNeto>
            <ImpOpEx>0</ImpOpEx>
            <ImpTrib>0</ImpTrib>
            <ImpIVA>${impIva.toFixed(2)}</ImpIVA>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            ${cbtesAsocXml}
            ${ivaXml}
          </FECAEDetRequest>
        </FeDetReq>
      </FeCAEReq>
    </FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(params.wsfeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
    },
    body: soapEnvelope,
  });

  const xmlText = await response.text();

  // Parsear resultado
  const resultadoMatch = xmlText.match(/<Resultado>(.*?)<\/Resultado>/);
  const caeMatch = xmlText.match(/<CAE>(.*?)<\/CAE>/);
  const caeVtoMatch = xmlText.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);

  if (resultadoMatch && resultadoMatch[1] === "A" && caeMatch) {
    const rawVto = caeVtoMatch ? caeVtoMatch[1] : "";
    const formattedVto =
      rawVto.length === 8
        ? `${rawVto.slice(0, 4)}-${rawVto.slice(4, 6)}-${rawVto.slice(6, 8)}`
        : new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);

    return {
      cae: caeMatch[1],
      caeDueDate: formattedVto,
      voucherNumber: params.nextVoucherNumber,
    };
  }

  // Extraer errores y observaciones devueltos por ARCA
  const errorMatches = Array.from(xmlText.matchAll(/<Msg>(.*?)<\/Msg>/g)).map((m) => m[1]);
  const errorMsg = errorMatches.length > 0 ? errorMatches.join(" | ") : "ARCA rechazó la autorización.";
  throw new Error(`Rechazo ARCA: ${errorMsg}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const body = (await req.json()) as ArcaRequestPayload;
    const { action, mode = "sandbox", cuit_emisor, punto_venta } = body;
    const cleanCuit = (cuit_emisor || "").replace(/\D/g, "");
    const env = mode === "real" ? "real" : "sandbox";
    const wsfeUrl = env === "real" ? WSFE_URLS.real : WSFE_URLS.sandbox;

    // ACCIÓN 1: PROBAR CONEXIÓN
    if (action === "test-connection") {
      try {
        const dummy = await callFeDummy(wsfeUrl);

        if (dummy.appServer === "OK" && dummy.dbServer === "OK") {
          let authStatus = "";
          if (body.certificate_crt && body.certificate_key) {
            try {
              const auth = await getWsaaAuth(env, cleanCuit, body.certificate_crt, body.certificate_key);
              authStatus = ` Autenticación WSAA exitosa (Token obtenido).`;
            } catch (wsaaErr) {
              authStatus = ` Alerta WSAA: ${wsaaErr instanceof Error ? wsaaErr.message : String(wsaaErr)}`;
            }
          }

          return jsonResponse({
            success: true,
            message: `Servidores ARCA (${env.toUpperCase()}) en línea: AppServer: ${dummy.appServer}, DbServer: ${dummy.dbServer}.${authStatus}`,
            dummy,
          });
        }

        return jsonResponse({
          success: false,
          error: `Los servidores de ARCA reportan problemas temporales: AppServer=${dummy.appServer}, DbServer=${dummy.dbServer}.`,
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: `No se pudo alcanzar ARCA (${wsfeUrl}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    }

    // ACCIÓN 2: EMISIÓN DE FACTURA O NOTA DE CRÉDITO
    if (action === "create-invoice" || action === "create-credit-note") {
      const isCreditNote = action === "create-credit-note";
      const docType = body.document_type || "C";
      const cbteTipo = isCreditNote
        ? CBTE_CREDIT_NOTE_CODES[docType] || 13
        : CBTE_INVOICE_CODES[docType] || 11;

      const total = Number(body.total) || 0;
      const subtotal = Number(body.subtotal) || total;
      const taxTotal = Number(body.tax_total) || 0;

      // Si se tienen certificados configurados y no es modo puramente mock, intentar emisión real ante ARCA
      if (mode !== "mock" && body.certificate_crt && body.certificate_key) {
        // 1. Obtener Token y Sign de WSAA
        const auth = await getWsaaAuth(env, cleanCuit, body.certificate_crt, body.certificate_key);

        // 2. Obtener último comprobante correlativo autorizado en ARCA
        const ultimoCbte = await getUltimoComprobante(wsfeUrl, auth, cleanCuit, punto_venta, cbteTipo);
        const nextVoucherNumber = ultimoCbte + 1;

        // 3. Solicitar CAE oficial ante ARCA
        const arcaRes = await solicitarCae({
          wsfeUrl,
          auth,
          cuit: cleanCuit,
          puntoVenta: punto_venta,
          cbteTipo,
          nextVoucherNumber,
          subtotal,
          taxTotal,
          total,
          receiverDocType: body.receiver_doc_type,
          receiverDocNumber: body.receiver_doc_number,
          associatedVoucher: body.associated_voucher,
        });

        // 4. Construir QR oficial de AFIP
        const qrData = {
          ver: 1,
          fecha: new Date().toISOString().slice(0, 10),
          cuit: Number(cleanCuit),
          ptoVta: punto_venta,
          tipoCmp: cbteTipo,
          nroCmp: arcaRes.voucherNumber,
          importe: Number(total.toFixed(2)),
          moneda: "PES",
          ctz: 1,
          tipoDocRec: body.receiver_doc_number ? (cleanCuit.length === 11 ? 80 : 96) : 99,
          nroDocRec: body.receiver_doc_number ? Number(body.receiver_doc_number.replace(/\D/g, "")) : 0,
          tipoCodAut: "E",
          codAut: Number(arcaRes.cae),
        };
        const qrPayload = btoa(JSON.stringify(qrData));
        const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrPayload}`;

        return jsonResponse({
          success: true,
          cae: arcaRes.cae,
          cae_due_date: arcaRes.caeDueDate,
          voucher_number: arcaRes.voucherNumber,
          qr_url: qrUrl,
          mode: env,
        });
      }

      // Si está en modo MOCK o aún no tiene certificados cargados:
      const today = new Date();
      const vtoDate = new Date(today);
      vtoDate.setDate(vtoDate.getDate() + 10);

      const voucherNumber = Math.floor(10 + Math.random() * 900);
      const randomSuffix = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const cae = `74${randomSuffix.slice(2)}`;
      const caeDueDate = vtoDate.toISOString().slice(0, 10);

      const qrData = {
        ver: 1,
        fecha: today.toISOString().slice(0, 10),
        cuit: Number(cleanCuit) || 20000000001,
        ptoVta: punto_venta,
        tipoCmp: cbteTipo,
        nroCmp: voucherNumber,
        importe: Number(total.toFixed(2)),
        moneda: "PES",
        ctz: 1,
        tipoDocRec: body.receiver_doc_number ? 80 : 99,
        nroDocRec: body.receiver_doc_number
          ? Number(body.receiver_doc_number.replace(/\D/g, ""))
          : 0,
        tipoCodAut: "E",
        codAut: Number(cae),
      };

      const qrPayload = btoa(JSON.stringify(qrData));
      const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrPayload}`;

      return jsonResponse({
        success: true,
        cae,
        cae_due_date: caeDueDate,
        voucher_number: voucherNumber,
        qr_url: qrUrl,
        mode: "mock",
        warning:
          mode !== "mock" && (!body.certificate_crt || !body.certificate_key)
            ? "Simulado (Falta configurar certificado .crt y clave .key para emitir en ARCA real)"
            : undefined,
      });
    }

    return jsonResponse({ error: "Acción no reconocida" }, 400);
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : "Error interno en Edge Function arca-billing",
      },
      500
    );
  }
});
