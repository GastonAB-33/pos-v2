import type { ProductFormValues } from "@/modules/productos/schemas/product-form.schema";
import type { Product as ProductEntity } from "@/types/entities";

export interface Product {
  id: string;
  tenant_id: string;
  nombre: string;
  imagen_url?: string;
  codigo_barras: string;
  codigo_producto: string;
  categoria: string;
  subcategoria: string;
  precio_costo: number;
  porcentaje_ganancia: number;
  precio_sin_iva: number;
  porcentaje_iva: number;
  precio_final: number;
  stock: number;
  is_favorite: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductFiltersState {
  search: string;
  category: string;
  subcategory: string;
  supplier: string;
}

export interface ProductAuditEntry {
  id: string;
  date: string;
  user: string;
  action: string;
  description: string;
}

export interface ProductFormModalValues extends ProductFormValues {
  favorito: boolean;
  estadoActivo: boolean;
  imagenFile?: File | null;
  imagenEliminada?: boolean;
}

export interface ProductViewModel {
  entity: ProductEntity;
  barcode: string;
  imagenUrl: string;
  nombre: string;
  codigoProducto: string;
  codigoBarras: string;
  saleMode: "unit" | "weight";
  categoria: string;
  subcategoria: string;
  proveedor: string;
  precioCosto: number;
  porcentajeGanancia: number;
  precioSinIva: number;
  porcentajeIva: number;
  precioFinal: number;
  stock: number;
  favorito: boolean;
  activo: boolean;
}
