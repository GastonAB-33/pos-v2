#!/usr/bin/env node
/**
 * POS V2 - Optimizador de Imágenes de Catálogo
 * Transforma imágenes sin procesar a formato cuadrado 800x800 con lienzo blanco puro (#FFFFFF)
 * y comprime a WebP de alta fidelidad (~40-60 KB por foto).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, "cache");
const RAW_DIR = path.resolve(CACHE_DIR, "raw");
const OPT_DIR = path.resolve(CACHE_DIR, "optimized");
const MANIFEST_PATH = path.resolve(CACHE_DIR, "manifest.json");

fs.mkdirSync(OPT_DIR, { recursive: true });

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

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export async function optimizeImage(rawPath, optPath, options = {}) {
  const {
    targetWidth = 800,
    targetHeight = 800,
    innerPadding = 30,
    quality = 85,
    backgroundColor = "#FFFFFF",
  } = options;

  const innerW = targetWidth - innerPadding * 2;
  const innerH = targetHeight - innerPadding * 2;

  // 1. Redimensionar preservando aspecto con fondo blanco
  const resizedBuffer = await sharp(rawPath)
    .flatten({ background: backgroundColor })
    .resize({
      width: innerW,
      height: innerH,
      fit: "contain",
      background: backgroundColor,
    })
    .toBuffer();

  // 2. Extender con padding para centrar en lienzo cuadrado de 800x800
  await sharp(resizedBuffer)
    .extend({
      top: innerPadding,
      bottom: innerPadding,
      left: innerPadding,
      right: innerPadding,
      background: backgroundColor,
    })
    .webp({ quality, effort: 4 })
    .toFile(optPath);

  const rawSize = fs.statSync(rawPath).size;
  const optSize = fs.statSync(optPath).size;

  return {
    rawSize,
    optSize,
    savedBytes: rawSize - optSize,
    savingRatio: ((1 - optSize / rawSize) * 100).toFixed(1),
  };
}

async function main() {
  const isForce = process.argv.includes("--force");
  console.log("🎨  Iniciando Optimizador de Imágenes de Catálogo (Lienzo Blanco + WebP)...\n");

  const manifest = loadManifest();

  if (!fs.existsSync(RAW_DIR)) {
    console.log("❌ No se encontró el directorio de imágenes raw. Ejecutá primero fetch-images.mjs");
    return;
  }

  const rawFiles = fs.readdirSync(RAW_DIR).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
  console.log(`📦 Imágenes crudas encontradas: ${rawFiles.length}`);

  let processedCount = 0;
  let alreadyOptimizedCount = 0;
  let totalSavedBytes = 0;

  for (let i = 0; i < rawFiles.length; i++) {
    const file = rawFiles[i];
    const barcode = file.replace(/\.[^.]+$/, "");
    const rawPath = path.resolve(RAW_DIR, file);
    const optPath = path.resolve(OPT_DIR, `${barcode}.webp`);

    // Si ya existe la versión optimizada en disco y no forzamos, omitir
    if (fs.existsSync(optPath) && !isForce) {
      alreadyOptimizedCount++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${rawFiles.length}] Optimizando ${barcode}... `);

    try {
      const stats = await optimizeImage(rawPath, optPath);
      processedCount++;
      totalSavedBytes += stats.savedBytes;

      if (manifest[barcode]) {
        manifest[barcode].optimizedFile = `optimized/${barcode}.webp`;
        manifest[barcode].optimizedBytes = stats.optSize;
        manifest[barcode].compressionRatio = `${stats.savingRatio}%`;
      }

      console.log(`✅ OK (${(stats.rawSize / 1024).toFixed(1)} KB -> ${(stats.optSize / 1024).toFixed(1)} KB WebP | ${stats.savingRatio}% ahorro)`);
    } catch (err) {
      console.log(`⚠️ ERROR: ${err.message}`);
    }
  }

  saveManifest(manifest);

  console.log("\n===========================================================");
  console.log("📊 RESUMEN DE OPTIMIZACIÓN:");
  console.log(`   * Procesadas nuevas:        ${processedCount}`);
  console.log(`   * Ya optimizadas en caché:  ${alreadyOptimizedCount}`);
  console.log(`   * Ancho de banda ahorrado:  ${(totalSavedBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`   * Total en WebP 800x800:    ${processedCount + alreadyOptimizedCount}`);
  console.log("===========================================================\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
