#!/usr/bin/env node
/**
 * POS V2 - Sincronizador de Imágenes con Cloudflare R2 & Base de Datos
 * Sube las imágenes WebP optimizadas a un bucket de Cloudflare R2 mediante el protocolo S3
 * y actualiza la columna image_url en la tabla public.master_products de Supabase.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, "cache");
const OPT_DIR = path.resolve(CACHE_DIR, "optimized");
const MANIFEST_PATH = path.resolve(CACHE_DIR, "manifest.json");

function loadEnv() {
  const envPath = path.resolve(__dirname, "../../.env");
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...vals] = trimmed.split("=");
      if (key && vals.length > 0) {
        env[key.trim()] = vals.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return env;
}

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

export function createR2Client(config) {
  const { accountId, accessKeyId, secretAccessKey } = config;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function uploadImageToR2(s3Client, bucketName, key, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
  });
  return await s3Client.send(command);
}

async function main() {
  console.log("☁️   Iniciando Sincronizador de Imágenes con Cloudflare R2...\n");

  const env = loadEnv();
  const manifest = loadManifest();

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME || "jireh-pos-products";
  const publicBaseUrl = (env.R2_PUBLIC_URL || "https://cdn.jireh.cloud").replace(/\/$/, "");

  const args = process.argv.slice(2);
  const isForce = args.includes("--force");
  const isDryRun = args.includes("--dry-run") || !accountId || !accessKeyId || !secretAccessKey;

  if (isDryRun && (!accountId || !accessKeyId || !secretAccessKey)) {
    console.log("ℹ️  Modo SIMULACIÓN (--dry-run) activado.");
    console.log("   (No se detectaron credenciales completas de R2 en .env)\n");
  }

  if (!fs.existsSync(OPT_DIR)) {
    console.log("❌ No se encontró la carpeta tools/catalog-images/cache/optimized. Ejecutá primero optimize-images.mjs");
    return;
  }

  const optFiles = fs.readdirSync(OPT_DIR).filter((f) => f.endsWith(".webp"));
  console.log(`📦 Imágenes WebP locales: ${optFiles.length}`);

  let s3 = null;
  if (!isDryRun) {
    try {
      s3 = createR2Client({ accountId, accessKeyId, secretAccessKey });
    } catch (err) {
      console.error("❌ Error al inicializar cliente S3/R2:", err.message);
      return;
    }
  }

  let uploadedCount = 0;
  let alreadyUploadedCount = 0;
  const sqlUpdates = [];

  for (let i = 0; i < optFiles.length; i++) {
    const file = optFiles[i];
    const barcode = file.replace(".webp", "");
    const filePath = path.resolve(OPT_DIR, file);
    const r2Key = `productos/${barcode}.webp`;
    const finalPublicUrl = `${publicBaseUrl}/${r2Key}`;

    // Si ya fue subido a R2 previamente y no forzamos
    if (manifest[barcode]?.r2UploadedAt && !isForce) {
      alreadyUploadedCount++;
      sqlUpdates.push(`UPDATE public.master_products SET image_url = '${finalPublicUrl}', updated_at = now() WHERE barcode = '${barcode}';`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${optFiles.length}] Subiendo ${r2Key}... `);

    if (isDryRun) {
      console.log(`[DRY-RUN] -> ${finalPublicUrl}`);
      uploadedCount++;
    } else {
      try {
        await uploadImageToR2(s3, bucketName, r2Key, filePath);
        console.log(`✅ OK -> ${finalPublicUrl}`);
        uploadedCount++;
      } catch (err) {
        console.log(`⚠️ ERROR SUBIDA: ${err.message}`);
        continue;
      }
    }

    if (manifest[barcode]) {
      manifest[barcode].r2PublicUrl = finalPublicUrl;
      manifest[barcode].r2UploadedAt = new Date().toISOString();
    }

    sqlUpdates.push(`UPDATE public.master_products SET image_url = '${finalPublicUrl}', updated_at = now() WHERE barcode = '${barcode}';`);
  }

  saveManifest(manifest);

  const sqlPath = path.resolve(CACHE_DIR, "sync_master_products_images.sql");
  fs.writeFileSync(sqlPath, sqlUpdates.join("\n"), "utf8");

  console.log("\n===========================================================");
  console.log("📊 RESUMEN DE SINCRONIZACIÓN:");
  console.log(`   * Nuevas subidas a R2:  ${uploadedCount}`);
  console.log(`   * Ya en R2 previamente: ${alreadyUploadedCount}`);
  console.log(`   * Total en R2:          ${uploadedCount + alreadyUploadedCount}`);
  console.log(`   * Bucket R2:            ${bucketName}`);
  console.log(`   * Script SQL generado:  tools/catalog-images/cache/sync_master_products_images.sql`);
  console.log("===========================================================\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
