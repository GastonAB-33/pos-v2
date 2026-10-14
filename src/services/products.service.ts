import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { isMockDataProvider } from "@/services/config/data-provider";
import type { Product, ProductBarcode } from "@/types/entities";

const crud = new TenantCrudService<Product>(dbTables.products);
const barcodeCrud = new TenantCrudService<ProductBarcode>(dbTables.product_barcodes);

export type CreateProductInput = CreateEntityInput<Product>;
export type UpdateProductInput = UpdateEntityInput<Product>;
export type CreateProductBarcodeInput = CreateEntityInput<ProductBarcode>;

const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, "");
const productImagesBucket =
  (import.meta.env.VITE_SUPABASE_PRODUCT_IMAGES_BUCKET as string | undefined)?.trim() ||
  "product-images";
const PRODUCT_IMAGE_MAX_SIZE = 720;
const PRODUCT_IMAGE_QUALITY = 0.78;

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo procesar la imagen seleccionada"));
    };
    image.src = url;
  });

const optimizeProductImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  const image = await loadImageFromFile(file);
  const maxDimension = Math.max(image.width, image.height);
  const scale = maxDimension > PRODUCT_IMAGE_MAX_SIZE ? PRODUCT_IMAGE_MAX_SIZE / maxDimension : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", PRODUCT_IMAGE_QUALITY);
  });

  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "producto";
  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
};

const fileToDataUrl = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer la imagen seleccionada"));
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
    reader.readAsDataURL(file);
  });
};

const extractStoragePathFromPublicUrl = (publicUrl: string): string | null => {
  const marker = `/storage/v1/object/public/${productImagesBucket}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) return null;

  const pathWithParams = publicUrl.slice(markerIndex + marker.length);
  const [path] = pathWithParams.split("?");
  return decodeURIComponent(path ?? "");
};

export const DELETED_PRODUCT_MARKER = "__ARCHIVED_DELETED__";

export const isArchivedDeletedProduct = (product: Product | null | undefined): boolean => {
  if (!product) return false;
  if (product.code?.startsWith("__deleted_")) return true;
  if (product.description?.includes(DELETED_PRODUCT_MARKER)) return true;
  return false;
};

const isForeignKeyDeleteError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    status?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const status =
    typeof candidate.status === "number"
      ? candidate.status
      : typeof candidate.status === "string"
        ? Number(candidate.status)
        : NaN;
  const message =
    `${typeof candidate.message === "string" ? candidate.message : ""} ${
      typeof candidate.details === "string" ? candidate.details : ""
    }`.toLowerCase();

  if (status === 409) return true;
  if (code === "23503") return true;
  return message.includes("foreign key") || message.includes("update or delete on table");
};

export const isSystemProduct = (product: Product | null | undefined): boolean => {
  if (!product) return false;
  if (product.code?.startsWith("SISTEMA_")) return true;
  return false;
};

export const productsService = {
  getAllByTenant: async (tenantId: string): Promise<Product[]> => {
    const all = await crud.getAllByTenant(tenantId);
    return all.filter((p) => !isArchivedDeletedProduct(p) && !isSystemProduct(p));
  },
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: async (tenantId: string, input: CreateProductInput) => {
    const rawCode = input.code?.trim();
    if (rawCode) {
      const normalizedCode = rawCode.toUpperCase();
      const existingByCode = await crud.query(tenantId, { eq: { code: rawCode } });
      const duplicateByCode = existingByCode.find(
        (p) => !isArchivedDeletedProduct(p) && p.code && p.code.trim().toUpperCase() === normalizedCode
      );
      if (duplicateByCode) {
        throw new Error(`Ya existe un producto con el código "${rawCode}" ("${duplicateByCode.name}")`);
      }

      const barcodeMatches = await barcodeCrud.query(tenantId, { eq: { barcode: rawCode } });
      const barcodeDuplicate = barcodeMatches.find(
        (b) => normalizeBarcode(b.barcode).toUpperCase() === normalizedCode
      );
      if (barcodeDuplicate) {
        const productWithBarcode = await crud.getById(tenantId, barcodeDuplicate.product_id);
        if (productWithBarcode && !isArchivedDeletedProduct(productWithBarcode)) {
          throw new Error(
            `El código "${rawCode}" ya está asignado como código de barras en el producto "${productWithBarcode.name}"`
          );
        }
        await barcodeCrud.delete(tenantId, barcodeDuplicate.id);
      }
    }
    return crud.create(tenantId, input);
  },
  update: async (tenantId: string, id: string, input: UpdateProductInput) => {
    const rawCode = input.code?.trim();
    if (rawCode) {
      const normalizedCode = rawCode.toUpperCase();
      const existingByCode = await crud.query(tenantId, { eq: { code: rawCode } });
      const duplicateByCode = existingByCode.find(
        (p) =>
          p.id !== id &&
          !isArchivedDeletedProduct(p) &&
          p.code &&
          p.code.trim().toUpperCase() === normalizedCode
      );
      if (duplicateByCode) {
        throw new Error(`Ya existe un producto con el código "${rawCode}" ("${duplicateByCode.name}")`);
      }

      const barcodeMatches = await barcodeCrud.query(tenantId, { eq: { barcode: rawCode } });
      const barcodeDuplicate = barcodeMatches.find(
        (b) => b.product_id !== id && normalizeBarcode(b.barcode).toUpperCase() === normalizedCode
      );
      if (barcodeDuplicate) {
        const productWithBarcode = await crud.getById(tenantId, barcodeDuplicate.product_id);
        if (productWithBarcode && !isArchivedDeletedProduct(productWithBarcode)) {
          throw new Error(
            `El código "${rawCode}" ya está asignado como código de barras en el producto "${productWithBarcode.name}"`
          );
        }
        await barcodeCrud.delete(tenantId, barcodeDuplicate.id);
      }
    }
    return crud.update(tenantId, id, input);
  },
  updateStock: async (tenantId: string, id: string, stockCurrent: number) =>
    crud.update(tenantId, id, {
      stock_current: stockCurrent,
      stock: stockCurrent,
    } as UpdateProductInput & { stock: number }),
  delete: async (tenantId: string, id: string): Promise<boolean> => {
    // 1. Limpiar todos los códigos de barras asociados para liberarlos por completo
    try {
      const productBarcodes = await barcodeCrud.query(tenantId, { eq: { product_id: id } });
      await Promise.all(productBarcodes.map((row) => barcodeCrud.delete(tenantId, row.id)));
    } catch {
      // Silenciar errores de limpieza de códigos al borrar producto
    }

    // 2. Intentar eliminación física directa de la tabla products
    try {
      return await crud.delete(tenantId, id);
    } catch (error) {
      // 3. Si tiene historial (ventas, compras o movimientos), ocultarlo permanentemente y liberar su código interno
      if (isForeignKeyDeleteError(error)) {
        const archived = await crud.update(tenantId, id, {
          is_active: false,
          is_favorite: false,
          code: `__deleted_${id.slice(0, 8)}_${Date.now()}`,
          description: DELETED_PRODUCT_MARKER,
        });
        return Boolean(archived);
      }
      throw error;
    }
  },
  getBarcodesByTenant: async (tenantId: string): Promise<ProductBarcode[]> => {
    const allBarcodes = await barcodeCrud.getAllByTenant(tenantId);
    const barcodesByProduct: Record<string, ProductBarcode[]> = {};

    for (const barcode of allBarcodes) {
      if (!barcode.barcode || !barcode.product_id) continue;
      if (!barcodesByProduct[barcode.product_id]) {
        barcodesByProduct[barcode.product_id] = [];
      }
      barcodesByProduct[barcode.product_id].push(barcode);
    }

    const activeBarcodes: ProductBarcode[] = [];

    // REGLA: Cada producto tiene un ÚNICO código de barra.
    // Purgar de la base de datos cualquier código duplicado u obsoleto conservando el más reciente.
    for (const items of Object.values(barcodesByProduct)) {
      if (items.length > 1) {
        items.sort((a, b) => {
          const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
          if (timeA !== timeB) return timeB - timeA;
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return 0;
        });

        const activeBarcode = items[0];
        const staleItems = items.slice(1);
        void Promise.all(staleItems.map((stale) => barcodeCrud.delete(tenantId, stale.id)));

        activeBarcodes.push({
          ...activeBarcode,
          is_primary: true,
        });
      } else if (items.length === 1) {
        activeBarcodes.push({
          ...items[0],
          is_primary: true,
        });
      }
    }

    return activeBarcodes;
  },

  getByBarcode: async (tenantId: string, rawBarcode: string): Promise<Product | null> => {
    const barcode = normalizeBarcode(rawBarcode);
    if (!barcode) return null;

    const matches = await barcodeCrud.query(tenantId, { eq: { barcode } });
    for (const match of matches) {
      // Verificar si este código es el activo más reciente del producto
      const productBarcodes = await barcodeCrud.query(tenantId, {
        eq: { product_id: match.product_id },
      });
      productBarcodes.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return 0;
      });

      const activePrimary = productBarcodes[0] ?? null;

      // Si el código no es el activo del producto, es un remanente obsoleto: purgarlo
      if (!activePrimary || activePrimary.id !== match.id || normalizeBarcode(activePrimary.barcode) !== barcode) {
        void barcodeCrud.delete(tenantId, match.id);
        continue;
      }

      // Si es el primario activo, verificar que el producto exista y no esté eliminado
      const product = await crud.getById(tenantId, match.product_id);
      if (product && !isArchivedDeletedProduct(product)) {
        return product;
      }

      // Si el producto no existe o fue eliminado, purgar código huérfano
      void barcodeCrud.delete(tenantId, match.id);
    }

    // Búsqueda por código de producto único
    const matchedProducts = await crud.query(tenantId, { eq: { code: barcode }, limit: 1 });
    const validMatch = matchedProducts.find((p) => !isArchivedDeletedProduct(p));
    return validMatch ?? null;
  },

  getPrimaryBarcodesMapByTenant: async (tenantId: string): Promise<Record<string, string>> => {
    const activeBarcodes = await productsService.getBarcodesByTenant(tenantId);
    const barcodeMap: Record<string, string> = {};
    for (const row of activeBarcodes) {
      if (row.product_id && row.barcode) {
        barcodeMap[row.product_id] = row.barcode;
      }
    }
    return barcodeMap;
  },

  setPrimaryBarcode: async (
    tenantId: string,
    productId: string,
    rawBarcode: string
  ): Promise<ProductBarcode | null> => {
    const barcode = normalizeBarcode(rawBarcode);

    // Si viene vacío, eliminar cualquier código de este producto
    if (!barcode) {
      const currentProductBarcodes = await barcodeCrud.query(tenantId, {
        eq: { product_id: productId },
      });
      await Promise.all(currentProductBarcodes.map((row) => barcodeCrud.delete(tenantId, row.id)));
      return null;
    }

    // 1. Validar que el código no pertenezca activamente a OTRO producto.
    // Regla: los productos tienen un único código de barra y un único código de producto.
    const matchesWithBarcode = await barcodeCrud.query(tenantId, { eq: { barcode } });
    for (const match of matchesWithBarcode) {
      if (match.product_id === productId) continue;

      const otherProductBarcodes = await barcodeCrud.query(tenantId, {
        eq: { product_id: match.product_id },
      });
      otherProductBarcodes.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return 0;
      });
      const otherPrimary = otherProductBarcodes[0] ?? null;

      // Si el otro producto tiene asignado OTRO código como activo (o este match no es primario),
      // este registro es un remanente obsoleto/fantasma: se elimina para liberar el código.
      if (!otherPrimary || otherPrimary.id !== match.id || normalizeBarcode(otherPrimary.barcode) !== barcode) {
        await barcodeCrud.delete(tenantId, match.id);
        continue;
      }

      // Si es el código activo del otro producto, verificar si el otro producto existe y no fue eliminado
      const otherProduct = await crud.getById(tenantId, match.product_id);
      if (!otherProduct || isArchivedDeletedProduct(otherProduct)) {
        // Producto ya inexistente o eliminado: purgar registro huérfano
        await barcodeCrud.delete(tenantId, match.id);
        continue;
      }

      // El código verdaderamente está asignado a otro producto existente
      throw new Error(`El código de barras ya está asignado al producto "${otherProduct.name}"`);
    }

    // 1.1 Validar que el código de barras no esté asignado como código interno de OTRO producto
    const allProducts = await productsService.getAllByTenant(tenantId);
    const productWithSameCode = allProducts.find(
      (p) => p.id !== productId && p.code && p.code.trim().toUpperCase() === barcode.toUpperCase()
    );
    if (productWithSameCode) {
      throw new Error(
        `El código de barras "${rawBarcode.trim()}" ya está asignado como código de producto en "${productWithSameCode.name}"`
      );
    }

    // 2. Gestionar los códigos del producto actual.
    // Un único código de barra por producto: purgar cualquier código anterior que difiera del nuevo.
    const currentProductBarcodes = await barcodeCrud.query(tenantId, {
      eq: { product_id: productId },
    });

    const obsoleteRows = currentProductBarcodes.filter(
      (item) => normalizeBarcode(item.barcode) !== barcode
    );
    await Promise.all(obsoleteRows.map((item) => barcodeCrud.delete(tenantId, item.id)));

    // Si ya existía este código para el producto actual, garantizar que esté como primario
    const existing = currentProductBarcodes.find(
      (item) => normalizeBarcode(item.barcode) === barcode
    );

    if (existing) {
      if (!existing.is_primary) {
        return barcodeCrud.update(tenantId, existing.id, {
          barcode,
          is_primary: true,
        });
      }
      return existing;
    }

    // Crear el nuevo registro único
    return barcodeCrud.create(tenantId, {
      product_id: productId,
      barcode,
      is_primary: true,
    } satisfies CreateProductBarcodeInput);
  },

  uploadProductImage: async (tenantId: string, productId: string, file: File): Promise<string> => {
    const optimizedFile = await optimizeProductImage(file);

    if (isMockDataProvider) {
      return fileToDataUrl(optimizedFile);
    }

    const normalizedExt = (optimizedFile.name.split(".").pop() ?? "jpg").toLowerCase();
    const extension = ["jpg", "jpeg", "png", "webp"].includes(normalizedExt) ? normalizedExt : "jpg";
    const path = `${tenantId}/${productId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${extension}`;

    const { error } = await supabase.storage.from(productImagesBucket).upload(path, optimizedFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: optimizedFile.type || "image/webp",
    });

    if (error) {
      throw new Error(`No se pudo subir la imagen: ${error.message}`);
    }

    const { data } = supabase.storage.from(productImagesBucket).getPublicUrl(path);
    return data.publicUrl;
  },

  deleteProductImageByUrl: async (publicUrl: string | null | undefined): Promise<void> => {
    if (!publicUrl || isMockDataProvider) return;

    const path = extractStoragePathFromPublicUrl(publicUrl);
    if (!path) return;

    const { error } = await supabase.storage.from(productImagesBucket).remove([path]);
    if (error) {
      throw new Error(`No se pudo eliminar la imagen anterior: ${error.message}`);
    }
  },

  ensureSpecialProduct: async (
    tenantId: string,
    specialCode: "SISTEMA_VENTA_MANUAL" | "SISTEMA_COBRO_CTA_CTE",
    defaultName: string
  ): Promise<Product> => {
    // 1. Buscar si ya existe este producto del sistema para el tenant
    const existingList = await crud.query(tenantId, {
      eq: { code: specialCode },
    });
    const found = existingList.find((p) => p.code === specialCode);
    if (found) return found;

    // 2. Si no existe, crearlo con is_active: false para que no aparezca en catálogo pero satisfaga FKs
    return crud.create(tenantId, {
      code: specialCode,
      name: defaultName,
      image_url: null,
      brand: null,
      supplier: null,
      is_favorite: false,
      description: "Producto de sistema para operaciones transitorias",
      price: 0,
      cost_price: 0,
      stock_current: 0,
      stock_min: null,
      stock_max: null,
      category: "Sistema",
      subcategory: null,
      sale_mode: "unit",
      currency_code: "ARS",
      price_without_vat: 0,
      vat_percent: 21,
      profit_percent: 0,
      is_active: false,
    });
  },
};
