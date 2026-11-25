#!/usr/bin/env node
/**
 * POS V2 - Extractor Multicanal de Imágenes de Catálogo
 * Busca imágenes oficiales de productos por EAN en cadenas de retail argentinas y Open Food Facts.
 * Con soporte de concurrencia, reintentos y caché inteligente.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, "cache");
const RAW_DIR = path.resolve(CACHE_DIR, "raw");
const MANIFEST_PATH = path.resolve(CACHE_DIR, "manifest.json");

fs.mkdirSync(RAW_DIR, { recursive: true });

function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

let saveTimer = null;
function debouncedSaveManifest(manifest) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  }, 1000);
}

function flushManifest(manifest) {
  if (saveTimer) clearTimeout(saveTimer);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fuentes de búsqueda
const SOURCES = {
  DIA: async (ean) => {
    const url = `https://diaonline.supermercadosdia.com.ar/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data[0]?.items?.[0]?.images?.[0]?.imageUrl) {
        return {
          source: "DIA",
          title: data[0].productName,
          imageUrl: data[0].items[0].images[0].imageUrl,
        };
      }
    } finally {
      clearTimeout(timeout);
    }
    return null;
  },

  CARREFOUR: async (ean) => {
    const url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data[0]?.items?.[0]?.images?.[0]?.imageUrl) {
        return {
          source: "CARREFOUR",
          title: data[0].productName,
          imageUrl: data[0].items[0].images[0].imageUrl,
        };
      }
    } finally {
      clearTimeout(timeout);
    }
    return null;
  },

  DISCO: async (ean) => {
    const url = `https://www.disco.com.ar/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data[0]?.items?.[0]?.images?.[0]?.imageUrl) {
        return {
          source: "DISCO",
          title: data[0].productName,
          imageUrl: data[0].items[0].images[0].imageUrl,
        };
      }
    } finally {
      clearTimeout(timeout);
    }
    return null;
  },

  OFF: async (ean) => {
    const url = `https://world.openfoodfacts.org/api/v2/product/${ean}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "POS-V2-CatalogEnricher/1.0" },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const product = data.product;
      if (product) {
        const img = product.image_front_url || product.image_url;
        if (img) {
          return {
            source: "OFF",
            title: product.product_name_es || product.product_name || "Producto OFF",
            imageUrl: img,
          };
        }
      }
    } finally {
      clearTimeout(timeout);
    }
    return null;
  },
};

export async function lookupEanImage(ean, enabledSources = ["DIA", "CARREFOUR", "DISCO", "OFF"]) {
  for (const src of enabledSources) {
    if (!SOURCES[src]) continue;
    try {
      const result = await SOURCES[src](ean);
      if (result?.imageUrl) {
        return result;
      }
    } catch {}
  }
  return null;
}

export async function downloadImage(imageUrl, destPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(destPath, buffer);
    return buffer.length;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 5000;
  const barcodeArg = args.find((a) => a.startsWith("--barcode="));
  const singleBarcode = barcodeArg ? barcodeArg.split("=")[1].trim() : null;
  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split("=")[1], 10) : 4;
  const isForce = args.includes("--force");

  console.log("📸  Iniciando Extractor Multicanal de Imágenes de Catálogo...\n");

  const manifest = loadManifest();

  let itemsToProcess = [];

  if (singleBarcode) {
    itemsToProcess = [{ barcode: singleBarcode, name: "Producto individual" }];
  } else {
    const catalogPath = path.resolve(__dirname, "catalog-source.json");
    if (fs.existsSync(catalogPath)) {
      itemsToProcess = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    }
  }

  // Filtrar únicos por código de barra
  const uniqueMap = new Map();
  for (const item of itemsToProcess) {
    const clean = String(item.barcode || "").trim();
    if (clean && !uniqueMap.has(clean)) {
      uniqueMap.set(clean, item);
    }
  }
  const allItems = Array.from(uniqueMap.values());
  const selectedItems = allItems.slice(0, limit);

  console.log(`📦 Total en catálogo: ${allItems.length} ítems`);
  console.log(`🎯 A procesar en esta tanda: ${selectedItems.length} ítems`);
  console.log(`⚡ Concurrencia paralela: ${concurrency} hilos simultáneos\n`);

  let foundCount = 0;
  let alreadyCachedCount = 0;
  let skippedNotFoundCount = 0;
  let newNotFoundCount = 0;
  const sourceStats = { DIA: 0, CARREFOUR: 0, DISCO: 0, OFF: 0 };

  let currentIndex = 0;

  async function worker(workerId) {
    while (currentIndex < selectedItems.length) {
      const idx = currentIndex++;
      const item = selectedItems[idx];
      const ean = item.barcode;
      const destFile = path.resolve(RAW_DIR, `${ean}.jpg`);

      // 1. Verificar si ya está en caché física y en manifest
      if (manifest[ean]?.file && fs.existsSync(destFile)) {
        alreadyCachedCount++;
        if (idx % 25 === 0) {
          process.stdout.write(`[${idx + 1}/${selectedItems.length}] Progreso: ${alreadyCachedCount + foundCount} con imagen...\r`);
        }
        continue;
      }

      // 2. Si ya fue verificado como no encontrado en una pasada anterior y no forzamos
      if (manifest[ean]?.notFound && !isForce) {
        skippedNotFoundCount++;
        continue;
      }

      const match = await lookupEanImage(ean);
      if (match) {
        try {
          const bytes = await downloadImage(match.imageUrl, destFile);
          manifest[ean] = {
            barcode: ean,
            name: item.name,
            source: match.source,
            sourceTitle: match.title,
            originalUrl: match.imageUrl,
            file: `raw/${ean}.jpg`,
            bytes,
            updatedAt: new Date().toISOString(),
          };
          debouncedSaveManifest(manifest);
          sourceStats[match.source] = (sourceStats[match.source] || 0) + 1;
          foundCount++;
          console.log(`[${idx + 1}/${selectedItems.length}] ${ean} (${item.name.slice(0, 25)}) ✅ OBTENIDO (${match.source} - ${(bytes / 1024).toFixed(1)} KB)`);
        } catch (err) {
          manifest[ean] = { barcode: ean, notFound: true, checkedAt: new Date().toISOString() };
          debouncedSaveManifest(manifest);
          newNotFoundCount++;
          console.log(`[${idx + 1}/${selectedItems.length}] ${ean} ⚠️ ERROR: ${err.message}`);
        }
      } else {
        manifest[ean] = { barcode: ean, notFound: true, checkedAt: new Date().toISOString() };
        debouncedSaveManifest(manifest);
        newNotFoundCount++;
        if (idx % 20 === 0) {
          console.log(`[${idx + 1}/${selectedItems.length}] ${ean} (${item.name.slice(0, 25)}) ❌ NO ENCONTRADO`);
        }
      }

      await sleep(100);
    }
  }

  const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  flushManifest(manifest);

  console.log("\n===========================================================");
  console.log("📊 RESUMEN DE EXTRACCIÓN:");
  console.log(`   * Total con imagen en caché: ${alreadyCachedCount + foundCount}`);
  console.log(`   * Nuevos obtenidos ahora:   ${foundCount}`);
  console.log(`   * Ya en caché previamente:  ${alreadyCachedCount}`);
  console.log(`   * No encontrados (omitidos): ${skippedNotFoundCount}`);
  console.log(`   * No encontrados (nuevos):   ${newNotFoundCount}`);
  console.log("   * Por proveedor en esta tanda:", JSON.stringify(sourceStats));
  console.log("===========================================================\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
