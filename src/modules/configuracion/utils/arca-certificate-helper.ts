/**
 * Utilidades para generación de claves, CSR (Certificate Signing Request)
 * y validación de certificados para ARCA (AFIP).
 */

// Helpers para codificación ASN.1 DER
function encodeLength(length: number): number[] {
  if (length < 128) {
    return [length];
  }
  const bytes: number[] = [];
  let temp = length;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

function derSequence(items: number[][]): number[] {
  const content = items.flat();
  return [0x30, ...encodeLength(content.length), ...content];
}

function derSet(items: number[][]): number[] {
  const content = items.flat();
  return [0x31, ...encodeLength(content.length), ...content];
}

function derOid(bytes: number[]): number[] {
  return [0x06, ...encodeLength(bytes.length), ...bytes];
}

function derUtf8String(str: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(str));
  return [0x0c, ...encodeLength(bytes.length), ...bytes];
}

function derPrintableString(str: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(str));
  return [0x13, ...encodeLength(bytes.length), ...bytes];
}

function derInteger(value: number): number[] {
  return [0x02, 0x01, value];
}

function derBitString(bytes: Uint8Array): number[] {
  // Primer byte de BIT STRING es el número de bits no usados (0)
  const content = [0x00, ...Array.from(bytes)];
  return [0x03, ...encodeLength(content.length), ...content];
}

function derToPem(buffer: ArrayBuffer | Uint8Array, label: string): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = window.btoa(binary);
  const formatted = base64.match(/.{1,64}/g)?.join("\n") || base64;
  return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----`;
}

// OIDs estándar para Subject en CSR
// 2.5.4.6 = countryName
const OID_C = [0x55, 0x04, 0x06];
// 2.5.4.10 = organizationName
const OID_O = [0x55, 0x04, 0x0a];
// 2.5.4.3 = commonName
const OID_CN = [0x55, 0x04, 0x03];
// 2.5.4.5 = serialNumber (Formato ARCA: "CUIT 20111111112")
const OID_SERIAL_NUMBER = [0x55, 0x04, 0x05];
// 1.2.840.113549.1.1.11 = sha256WithRSAEncryption
const OID_SHA256_RSA = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b];

function buildAttributeTypeAndValue(oid: number[], valueBytes: number[]): number[] {
  return derSet([derSequence([derOid(oid), valueBytes])]);
}

export interface GeneratedArcaCredentials {
  privateKeyPem: string;
  csrPem: string;
  cuit: string;
  businessName: string;
  alias: string;
}

/**
 * Genera un par de claves RSA 2048 y una solicitud de certificado (CSR) PKCS#10
 * directamente en el navegador mediante Web Crypto API, compatible con ARCA.
 */
export async function generateArcaKeyPairAndCsr(params: {
  cuit: string;
  businessName: string;
  alias?: string;
}): Promise<GeneratedArcaCredentials> {
  const cleanCuit = params.cuit.replace(/\D/g, "");
  const businessName = params.businessName.trim() || "Comercio";
  const alias = params.alias?.trim() || `pos-v2-${cleanCuit}`;

  // 1. Generar par de claves RSA de 2048 bits
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );

  // 2. Exportar Clave Privada en formato PKCS#8 PEM
  const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const privateKeyPem = derToPem(pkcs8, "PRIVATE KEY");

  // 3. Exportar Clave Pública en formato SPKI DER
  const spki = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const spkiBytes = Array.from(new Uint8Array(spki));

  // 4. Construir Subject según normativa de ARCA
  const subjectAttrs = [
    buildAttributeTypeAndValue(OID_C, derPrintableString("AR")),
    buildAttributeTypeAndValue(OID_O, derUtf8String(businessName)),
    buildAttributeTypeAndValue(OID_CN, derUtf8String(alias)),
    buildAttributeTypeAndValue(OID_SERIAL_NUMBER, derPrintableString(`CUIT ${cleanCuit}`)),
  ];
  const subjectDer = derSequence(subjectAttrs);

  // 5. Construir CertificationRequestInfo
  // CertificationRequestInfo ::= SEQUENCE {
  //   version INTEGER (0),
  //   subject Name,
  //   subjectPKInfo SubjectPublicKeyInfo,
  //   attributes [0] IMPLICIT Attributes (vacío: 0xA0 0x00)
  // }
  const criDer = derSequence([
    derInteger(0),
    subjectDer,
    spkiBytes,
    [0xa0, 0x00], // [0] Attributes vacío
  ]);

  // 6. Firmar CertificationRequestInfo con la Clave Privada (SHA-256 con RSA)
  const signatureBuffer = await window.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new Uint8Array(criDer)
  );

  // 7. Construir CertificationRequest final
  // AlgorithmIdentifier: sha256WithRSAEncryption con NULL params
  const sigAlg = derSequence([derOid(OID_SHA256_RSA), [0x05, 0x00]]);
  const signatureBitString = derBitString(new Uint8Array(signatureBuffer));

  const certificationRequestDer = derSequence([
    criDer,
    sigAlg,
    signatureBitString,
  ]);

  const csrPem = derToPem(new Uint8Array(certificationRequestDer), "CERTIFICATE REQUEST");

  return {
    privateKeyPem,
    csrPem,
    cuit: cleanCuit,
    businessName,
    alias,
  };
}

/**
 * Genera el comando OpenSSL exacto por si el usuario o su contador prefieren
 * generarlo por consola/terminal de forma manual.
 */
export function generateOpenSslCommand(params: {
  cuit: string;
  businessName: string;
  alias?: string;
}): string {
  const cleanCuit = params.cuit.replace(/\D/g, "");
  const businessName = params.businessName.trim() || "Comercio";
  const alias = params.alias?.trim() || "pos-v2";

  return `openssl genrsa -out privada_arca.key 2048\nopenssl req -new -key privada_arca.key -subj "/C=AR/O=${businessName}/CN=${alias}/serialNumber=CUIT ${cleanCuit}" -out pedido_arca.csr`;
}

/**
 * Valida el formato básico de un archivo de Certificado Digital (.crt / .pem)
 */
export function validateCertificateCrt(content: string): {
  valid: boolean;
  message: string;
} {
  const clean = content.trim();
  if (!clean.includes("-----BEGIN CERTIFICATE-----") || !clean.includes("-----END CERTIFICATE-----")) {
    return {
      valid: false,
      message: "El archivo no parece ser un certificado válido X.509 (debe comenzar con '-----BEGIN CERTIFICATE-----').",
    };
  }
  return { valid: true, message: "Certificado con formato PEM válido." };
}

/**
 * Valida el formato básico de un archivo de Clave Privada (.key / .pem)
 */
export function validatePrivateKey(content: string): {
  valid: boolean;
  message: string;
} {
  const clean = content.trim();
  const hasKeyHeader =
    clean.includes("-----BEGIN PRIVATE KEY-----") ||
    clean.includes("-----BEGIN RSA PRIVATE KEY-----");
  if (!hasKeyHeader) {
    return {
      valid: false,
      message: "El archivo no contiene una clave privada válida (debe comenzar con '-----BEGIN PRIVATE KEY-----').",
    };
  }
  return { valid: true, message: "Clave privada con formato PEM válido." };
}

/**
 * Descarga un archivo de texto en el navegador del usuario
 */
export function downloadFile(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
