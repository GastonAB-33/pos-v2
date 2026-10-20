var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import forge from "node-forge";
var WSAA_URLS = {
    sandbox: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    real: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
};
var WSFE_URLS = {
    sandbox: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    real: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
};
var CBTE_INVOICE_CODES = {
    A: 1,
    B: 6,
    C: 11,
};
var CBTE_CREDIT_NOTE_CODES = {
    A: 3,
    B: 8,
    C: 13,
};
var tokenCache = new Map();
function toArgentinaIso(date) {
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var offset = -3;
    var localDate = new Date(date.getTime() + offset * 60 * 60 * 1000);
    var y = localDate.getUTCFullYear();
    var m = pad(localDate.getUTCMonth() + 1);
    var d = pad(localDate.getUTCDate());
    var h = pad(localDate.getUTCHours());
    var min = pad(localDate.getUTCMinutes());
    var s = pad(localDate.getUTCSeconds());
    return "".concat(y, "-").concat(m, "-").concat(d, "T").concat(h, ":").concat(min, ":").concat(s, "-03:00");
}
function signTraXml(traXml, certPem, keyPem) {
    var pki = forge.pki;
    var cert = pki.certificateFromPem(certPem);
    var privateKey;
    try {
        privateKey = pki.privateKeyFromPem(keyPem);
    }
    catch (_a) {
        privateKey = pki.decryptRsaPrivateKey(keyPem);
    }
    var p7 = forge.pkcs7.createSignedData();
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
    var der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    return forge.util.encode64(der);
}
function getWsaaAuth(env, cuit, certPem, keyPem) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, now, cached, wsaaUrl, genTime, expTime, uniqueId, traXml, cmsB64, soapEnvelope, response, responseXml, faultMatch, faultMsg, tokenMatch, signMatch, expMatch, token, sign, expiresAt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cacheKey = "".concat(env, "_").concat(cuit);
                    now = Date.now();
                    cached = tokenCache.get(cacheKey);
                    if (cached && cached.expiresAt > now + 10 * 60 * 1000) {
                        return [2 /*return*/, { token: cached.token, sign: cached.sign }];
                    }
                    wsaaUrl = env === "real" ? WSAA_URLS.real : WSAA_URLS.sandbox;
                    genTime = toArgentinaIso(new Date(now - 10 * 60 * 1000));
                    expTime = toArgentinaIso(new Date(now + 10 * 60 * 1000));
                    uniqueId = Math.floor(now / 1000);
                    traXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<loginTicketRequest version=\"1.0\">\n  <header>\n    <uniqueId>".concat(uniqueId, "</uniqueId>\n    <generationTime>").concat(genTime, "</generationTime>\n    <expirationTime>").concat(expTime, "</expirationTime>\n  </header>\n  <service>wsfe</service>\n</loginTicketRequest>");
                    cmsB64 = signTraXml(traXml, certPem, keyPem);
                    soapEnvelope = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:wsaa=\"http://wsaa.view.sua.dvadac.desein.afip.gov\">\n  <soapenv:Header/>\n  <soapenv:Body>\n    <wsaa:loginCms>\n      <wsaa:in0>".concat(cmsB64, "</wsaa:in0>\n    </wsaa:loginCms>\n  </soapenv:Body>\n</soapenv:Envelope>");
                    return [4 /*yield*/, fetch(wsaaUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "text/xml; charset=utf-8",
                                SOAPAction: "",
                            },
                            body: soapEnvelope,
                        })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 2:
                    responseXml = _a.sent();
                    if (!response.ok || responseXml.includes("<faultstring>")) {
                        faultMatch = responseXml.match(/<faultstring>(.*?)<\/faultstring>/);
                        faultMsg = faultMatch ? faultMatch[1] : "HTTP ".concat(response.status);
                        throw new Error("WSAA Rechaz\u00F3 la autenticaci\u00F3n: ".concat(faultMsg));
                    }
                    tokenMatch = responseXml.match(/<token>(.*?)<\/token>/);
                    signMatch = responseXml.match(/<sign>(.*?)<\/sign>/);
                    expMatch = responseXml.match(/<expirationTime>(.*?)<\/expirationTime>/);
                    if (!tokenMatch || !signMatch) {
                        throw new Error("WSAA no devolvió token o sign válidos.");
                    }
                    token = tokenMatch[1];
                    sign = signMatch[1];
                    expiresAt = expMatch ? new Date(expMatch[1]).getTime() : now + 11 * 3600 * 1000;
                    tokenCache.set(cacheKey, { token: token, sign: sign, expiresAt: expiresAt });
                    return [2 /*return*/, { token: token, sign: sign }];
            }
        });
    });
}
function callFeDummy(endpointUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var soapEnvelope, response, xmlText, appServerMatch, dbServerMatch, authServerMatch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    soapEnvelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <FEDummy xmlns=\"http://ar.gov.afip.dif.FEV1/\" />\n  </soap:Body>\n</soap:Envelope>";
                    return [4 /*yield*/, fetch(endpointUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "text/xml; charset=utf-8",
                                SOAPAction: "http://ar.gov.afip.dif.FEV1/FEDummy",
                            },
                            body: soapEnvelope,
                        })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 2:
                    xmlText = _a.sent();
                    appServerMatch = xmlText.match(/<AppServer>(.*?)<\/AppServer>/);
                    dbServerMatch = xmlText.match(/<DbServer>(.*?)<\/DbServer>/);
                    authServerMatch = xmlText.match(/<AuthServer>(.*?)<\/AuthServer>/);
                    return [2 /*return*/, {
                            appServer: appServerMatch ? appServerMatch[1] : "UNKNOWN",
                            dbServer: dbServerMatch ? dbServerMatch[1] : "UNKNOWN",
                            authServer: authServerMatch ? authServerMatch[1] : "UNKNOWN",
                        }];
            }
        });
    });
}
function getUltimoComprobante(wsfeUrl, auth, cuit, puntoVenta, cbteTipo) {
    return __awaiter(this, void 0, void 0, function () {
        var soapEnvelope, response, xmlText, nroMatch;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    soapEnvelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <FECompUltimoAutorizado xmlns=\"http://ar.gov.afip.dif.FEV1/\">\n      <Auth>\n        <Token>".concat(auth.token, "</Token>\n        <Sign>").concat(auth.sign, "</Sign>\n        <Cuit>").concat(cuit, "</Cuit>\n      </Auth>\n      <PtoVta>").concat(puntoVenta, "</PtoVta>\n      <CbteTipo>").concat(cbteTipo, "</CbteTipo>\n    </FECompUltimoAutorizado>\n  </soap:Body>\n</soap:Envelope>");
                    return [4 /*yield*/, fetch(wsfeUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "text/xml; charset=utf-8",
                                SOAPAction: "http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado",
                            },
                            body: soapEnvelope,
                        })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 2:
                    xmlText = _a.sent();
                    nroMatch = xmlText.match(/<CbteNro>(.*?)<\/CbteNro>/);
                    if (nroMatch) {
                        return [2 /*return*/, parseInt(nroMatch[1], 10) || 0];
                    }
                    return [2 /*return*/, 0];
            }
        });
    });
}
function solicitarCae(params) {
    return __awaiter(this, void 0, void 0, function () {
        var today, yyyymmdd, cleanReceiverDoc, docTipo, docNro, isFacturaC, impTotal, impNeto, impIva, ivaXml, cbtesAsocXml, soapEnvelope, response, xmlText, resultadoMatch, caeMatch, caeVtoMatch, rawVto, formattedVto, errorMatches, errorMsg;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = new Date();
                    yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, "");
                    cleanReceiverDoc = (params.receiverDocNumber || "").replace(/\D/g, "");
                    docTipo = 99;
                    docNro = "0";
                    if (cleanReceiverDoc.length === 11) {
                        docTipo = 80;
                        docNro = cleanReceiverDoc;
                    }
                    else if (cleanReceiverDoc.length === 8 || cleanReceiverDoc.length === 7) {
                        docTipo = 96;
                        docNro = cleanReceiverDoc;
                    }
                    isFacturaC = params.cbteTipo === 11 || params.cbteTipo === 13;
                    impTotal = Number(params.total.toFixed(2));
                    impNeto = isFacturaC ? impTotal : Number(params.subtotal.toFixed(2));
                    impIva = isFacturaC ? 0 : Number(params.taxTotal.toFixed(2));
                    ivaXml = "";
                    if (!isFacturaC && impIva > 0) {
                        ivaXml = "<Iva>\n      <AlicIva>\n        <Id>5</Id>\n        <BaseImp>".concat(impNeto.toFixed(2), "</BaseImp>\n        <Importe>").concat(impIva.toFixed(2), "</Importe>\n      </AlicIva>\n    </Iva>");
                    }
                    cbtesAsocXml = "";
                    if (params.associatedVoucher) {
                        cbtesAsocXml = "<CbtesAsoc>\n      <CbteAsoc>\n        <Tipo>".concat(params.associatedVoucher.tipo, "</Tipo>\n        <PtoVta>").concat(params.associatedVoucher.punto_venta, "</PtoVta>\n        <Nro>").concat(params.associatedVoucher.numero, "</Nro>\n        <Cuit>").concat(params.associatedVoucher.cuit || params.cuit, "</Cuit>\n      </CbteAsoc>\n    </CbtesAsoc>");
                    }
                    soapEnvelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <FECAESolicitar xmlns=\"http://ar.gov.afip.dif.FEV1/\">\n      <Auth>\n        <Token>".concat(params.auth.token, "</Token>\n        <Sign>").concat(params.auth.sign, "</Sign>\n        <Cuit>").concat(params.cuit, "</Cuit>\n      </Auth>\n      <FeCAEReq>\n        <FeCabReq>\n          <CantReg>1</CantReg>\n          <PtoVta>").concat(params.puntoVenta, "</PtoVta>\n          <CbteTipo>").concat(params.cbteTipo, "</CbteTipo>\n        </FeCabReq>\n        <FeDetReq>\n          <FECAEDetRequest>\n            <Concepto>1</Concepto>\n            <DocTipo>").concat(docTipo, "</DocTipo>\n            <DocNro>").concat(docNro, "</DocNro>\n            <CbteDesde>").concat(params.nextVoucherNumber, "</CbteDesde>\n            <CbteHasta>").concat(params.nextVoucherNumber, "</CbteHasta>\n            <CbteFch>").concat(yyyymmdd, "</CbteFch>\n            <ImpTotal>").concat(impTotal.toFixed(2), "</ImpTotal>\n            <ImpTotConc>0</ImpTotConc>\n            <ImpNeto>").concat(impNeto.toFixed(2), "</ImpNeto>\n            <ImpOpEx>0</ImpOpEx>\n            <ImpTrib>0</ImpTrib>\n            <ImpIVA>").concat(impIva.toFixed(2), "</ImpIVA>\n            <MonId>PES</MonId>\n            <MonCotiz>1</MonCotiz>\n            ").concat(cbtesAsocXml, "\n            ").concat(ivaXml, "\n          </FECAEDetRequest>\n        </FeDetReq>\n      </FeCAEReq>\n    </FECAESolicitar>\n  </soap:Body>\n</soap:Envelope>");
                    return [4 /*yield*/, fetch(params.wsfeUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "text/xml; charset=utf-8",
                                SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar",
                            },
                            body: soapEnvelope,
                        })];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.text()];
                case 2:
                    xmlText = _a.sent();
                    resultadoMatch = xmlText.match(/<Resultado>(.*?)<\/Resultado>/);
                    caeMatch = xmlText.match(/<CAE>(.*?)<\/CAE>/);
                    caeVtoMatch = xmlText.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);
                    if (resultadoMatch && resultadoMatch[1] === "A" && caeMatch) {
                        rawVto = caeVtoMatch ? caeVtoMatch[1] : "";
                        formattedVto = rawVto.length === 8
                            ? "".concat(rawVto.slice(0, 4), "-").concat(rawVto.slice(4, 6), "-").concat(rawVto.slice(6, 8))
                            : new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
                        return [2 /*return*/, {
                                cae: caeMatch[1],
                                caeDueDate: formattedVto,
                                voucherNumber: params.nextVoucherNumber,
                            }];
                    }
                    errorMatches = Array.from(xmlText.matchAll(/<Msg>(.*?)<\/Msg>/g)).map(function (m) { return m[1]; });
                    errorMsg = errorMatches.length > 0 ? errorMatches.join(" | ") : "ARCA rechazó la autorización.";
                    throw new Error("Rechazo ARCA: ".concat(errorMsg));
            }
        });
    });
}
export function handleArcaBillingRequest(body) {
    return __awaiter(this, void 0, void 0, function () {
        var action, _a, mode, cuit_emisor, punto_venta, cleanCuit, env, wsfeUrl, dummy, authStatus, wsaaErr_1, isCreditNote, docType, cbteTipo, total, subtotal, taxTotal, auth, ultimoCbte, nextVoucherNumber, arcaRes, qrData_1, qrPayload_1, qrUrl_1, today, vtoDate, voucherNumber, randomSuffix, cae, caeDueDate, qrData, qrPayload, qrUrl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    action = body.action, _a = body.mode, mode = _a === void 0 ? "sandbox" : _a, cuit_emisor = body.cuit_emisor, punto_venta = body.punto_venta;
                    cleanCuit = (cuit_emisor || "").replace(/\D/g, "");
                    env = mode === "real" ? "real" : "sandbox";
                    wsfeUrl = env === "real" ? WSFE_URLS.real : WSFE_URLS.sandbox;
                    if (!(action === "test-connection")) return [3 /*break*/, 7];
                    return [4 /*yield*/, callFeDummy(wsfeUrl)];
                case 1:
                    dummy = _b.sent();
                    if (!(dummy.appServer === "OK" && dummy.dbServer === "OK")) return [3 /*break*/, 6];
                    authStatus = "";
                    if (!(body.certificate_crt && body.certificate_key)) return [3 /*break*/, 5];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getWsaaAuth(env, cleanCuit, body.certificate_crt, body.certificate_key)];
                case 3:
                    _b.sent();
                    authStatus = " Autenticaci\u00F3n WSAA exitosa (Token obtenido).";
                    return [3 /*break*/, 5];
                case 4:
                    wsaaErr_1 = _b.sent();
                    authStatus = " Alerta WSAA: ".concat(wsaaErr_1 instanceof Error ? wsaaErr_1.message : String(wsaaErr_1));
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, {
                        success: true,
                        message: "Servidores ARCA (".concat(env.toUpperCase(), ") en l\u00EDnea: AppServer: ").concat(dummy.appServer, ", DbServer: ").concat(dummy.dbServer, ".").concat(authStatus),
                        dummy: dummy,
                    }];
                case 6: return [2 /*return*/, {
                        success: false,
                        error: "Los servidores de ARCA reportan problemas temporales: AppServer=".concat(dummy.appServer, ", DbServer=").concat(dummy.dbServer, "."),
                    }];
                case 7:
                    if (!(action === "create-invoice" || action === "create-credit-note")) return [3 /*break*/, 12];
                    isCreditNote = action === "create-credit-note";
                    docType = body.document_type || "B";
                    cbteTipo = isCreditNote
                        ? CBTE_CREDIT_NOTE_CODES[docType] || 8
                        : CBTE_INVOICE_CODES[docType] || 6;
                    total = Number(body.total) || 0;
                    subtotal = Number(body.subtotal) || total;
                    taxTotal = Number(body.tax_total) || 0;
                    if (!(mode !== "mock" && body.certificate_crt && body.certificate_key)) return [3 /*break*/, 11];
                    return [4 /*yield*/, getWsaaAuth(env, cleanCuit, body.certificate_crt, body.certificate_key)];
                case 8:
                    auth = _b.sent();
                    return [4 /*yield*/, getUltimoComprobante(wsfeUrl, auth, cleanCuit, punto_venta, cbteTipo)];
                case 9:
                    ultimoCbte = _b.sent();
                    nextVoucherNumber = ultimoCbte + 1;
                    return [4 /*yield*/, solicitarCae({
                            wsfeUrl: wsfeUrl,
                            auth: auth,
                            cuit: cleanCuit,
                            puntoVenta: punto_venta,
                            cbteTipo: cbteTipo,
                            nextVoucherNumber: nextVoucherNumber,
                            subtotal: subtotal,
                            taxTotal: taxTotal,
                            total: total,
                            receiverDocType: body.receiver_doc_type,
                            receiverDocNumber: body.receiver_doc_number,
                            associatedVoucher: body.associated_voucher,
                        })];
                case 10:
                    arcaRes = _b.sent();
                    qrData_1 = {
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
                    qrPayload_1 = Buffer.from(JSON.stringify(qrData_1)).toString("base64");
                    qrUrl_1 = "https://www.afip.gob.ar/fe/qr/?p=".concat(qrPayload_1);
                    return [2 /*return*/, {
                            success: true,
                            cae: arcaRes.cae,
                            cae_due_date: arcaRes.caeDueDate,
                            voucher_number: arcaRes.voucherNumber,
                            qr_url: qrUrl_1,
                            mode: env,
                        }];
                case 11:
                    today = new Date();
                    vtoDate = new Date(today);
                    vtoDate.setDate(vtoDate.getDate() + 10);
                    voucherNumber = Math.floor(10 + Math.random() * 900);
                    randomSuffix = Math.floor(100000000000 + Math.random() * 900000000000).toString();
                    cae = "74".concat(randomSuffix.slice(2));
                    caeDueDate = vtoDate.toISOString().slice(0, 10);
                    qrData = {
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
                    qrPayload = Buffer.from(JSON.stringify(qrData)).toString("base64");
                    qrUrl = "https://www.afip.gob.ar/fe/qr/?p=".concat(qrPayload);
                    return [2 /*return*/, {
                            success: true,
                            cae: cae,
                            cae_due_date: caeDueDate,
                            voucher_number: voucherNumber,
                            qr_url: qrUrl,
                            mode: "mock",
                        }];
                case 12: throw new Error("Acción no reconocida");
            }
        });
    });
}
