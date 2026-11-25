#!/usr/bin/env node
/**
 * POS V2 - Pipeline Integral de Imágenes para Catálogo y Cloudflare R2
 * Ejecuta en secuencia:
 * 1. Extracción multicanal (DIA, Carrefour, Disco, Open Food Facts)
 * 2. Normalización de lienzo blanco y compresión WebP 800x800
 * 3. Sincronización con bucket Cloudflare R2 y generación de script SQL para Supabase
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2).join(" ");

console.log("🚀 ===========================================================");
console.log("   INICIANDO PIPELINE DE IMÁGENES RETAIL (CLOUDFLARE R2)");
console.log("===========================================================\n");

try {
  console.log("▶️  ETAPA 1: Extracción de imágenes...");
  execSync(`node "${path.resolve(__dirname, "fetch-images.mjs")}" ${args}`, { stdio: "inherit" });

  console.log("\n▶️  ETAPA 2: Optimización a WebP 800x800 con lienzo blanco...");
  execSync(`node "${path.resolve(__dirname, "optimize-images.mjs")}"`, { stdio: "inherit" });

  console.log("\n▶️  ETAPA 3: Sincronización con Cloudflare R2 y SQL Supabase...");
  execSync(`node "${path.resolve(__dirname, "sync-r2.mjs")}" ${args}`, { stdio: "inherit" });

  console.log("\n🎉 ===========================================================");
  console.log("   PIPELINE COMPLETADO CON ÉXITO");
  console.log("===========================================================\n");
} catch (err) {
  console.error("\n❌ Error en ejecución del pipeline:", err.message);
  process.exit(1);
}
