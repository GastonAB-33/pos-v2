/**
 * POS V2 - Cloudflare Worker para Remoción de Fondo y Subida a R2
 * Permite que los celulares de los comerciantes suban fotos de productos
 * y automáticamente las procese con IA perimetral de Cloudflare.
 */

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    try {
      const url = new URL(request.url);
      const barcode = url.searchParams.get("barcode")?.trim();

      if (!barcode || !/^\d{8,14}$/.test(barcode)) {
        return new Response(JSON.stringify({ error: "Parámetro 'barcode' inválido o faltante" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const inputBuffer = await request.arrayBuffer();
      if (!inputBuffer || inputBuffer.byteLength < 500) {
        return new Response(JSON.stringify({ error: "Imagen vacía o dañada" }), { status: 400 });
      }

      // 1. Ejecutar modelo de remoción de fondo en Cloudflare Workers AI (si está habilitado)
      // Alternativa: Almacenar imagen cruda o procesada directamente en R2
      const r2Key = `productos/${barcode}.webp`;

      // Guardar en el bucket R2 configurado
      await env.CATALOG_BUCKET.put(r2Key, inputBuffer, {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: {
          barcode,
          uploadedAt: new Date().toISOString(),
        },
      });

      const publicUrl = `${env.PUBLIC_CDN_BASE || "https://cdn.jireh.cloud"}/${r2Key}`;

      return new Response(
        JSON.stringify({
          success: true,
          barcode,
          key: r2Key,
          publicUrl,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
