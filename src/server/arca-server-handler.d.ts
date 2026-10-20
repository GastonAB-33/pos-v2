/**
 * Handler de desarrollo para ARCA (ex AFIP)
 * Ejecutado por el servidor Vite para procesar peticiones a /functions/v1/arca-billing
 * evitando bloqueos de CORS del navegador y permitiendo pruebas locales 100% reales.
 */
export interface ArcaDevRequestPayload {
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
export declare function handleArcaBillingRequest(body: ArcaDevRequestPayload): Promise<{
    success: boolean;
    message: string;
    dummy: {
        appServer: string;
        dbServer: string;
        authServer: string;
    };
    error?: undefined;
    cae?: undefined;
    cae_due_date?: undefined;
    voucher_number?: undefined;
    qr_url?: undefined;
    mode?: undefined;
} | {
    success: boolean;
    error: string;
    message?: undefined;
    dummy?: undefined;
    cae?: undefined;
    cae_due_date?: undefined;
    voucher_number?: undefined;
    qr_url?: undefined;
    mode?: undefined;
} | {
    success: boolean;
    cae: string;
    cae_due_date: string;
    voucher_number: number;
    qr_url: string;
    mode: string;
    message?: undefined;
    dummy?: undefined;
    error?: undefined;
}>;
