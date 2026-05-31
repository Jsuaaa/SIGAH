// Tipos de recurso (catálogo de inventario y donaciones) — HU-14.
// Espejo de server/src/types/entities.ts (RESOURCE_CATEGORIES) y de la vista
// pública server/src/views/inventory.view.ts (resourceTypeView).
//
// Este módulo es la fuente central de las categorías de recurso: lo reutilizan
// Inventario (HU-15/16/17) y Donaciones (HU-18+) para no duplicar el enum ni sus
// etiquetas en español.

// Enum del backend (no se traduce el valor; solo la etiqueta visible).
export type ResourceCategory = 'FOOD' | 'BLANKET' | 'MATTRESS' | 'HYGIENE' | 'MEDICATION'

export const RESOURCE_CATEGORY_OPTIONS: { value: ResourceCategory; label: string }[] = [
  { value: 'FOOD', label: 'Alimentos' },
  { value: 'BLANKET', label: 'Cobijas' },
  { value: 'MATTRESS', label: 'Colchones' },
  { value: 'HYGIENE', label: 'Higiene' },
  { value: 'MEDICATION', label: 'Medicamentos' },
]

export const RESOURCE_CATEGORY_LABELS = Object.fromEntries(
  RESOURCE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ResourceCategory, string>

// Clases Tailwind por categoría para el badge de color en la tabla.
export const RESOURCE_CATEGORY_BADGE: Record<ResourceCategory, string> = {
  FOOD: 'text-success bg-success-bg border-success-br',
  BLANKET: 'text-primary-700 bg-info-bg border-info-br',
  MATTRESS: 'text-warning bg-warning-bg border-warning-br',
  HYGIENE: 'text-neutral-700 bg-neutral-100 border-neutral-200',
  MEDICATION: 'text-danger bg-danger-bg border-danger-br',
}

// Tipo de recurso tal como lo devuelve GET /resource-types y GET /resource-types/:id
// (server/src/views/inventory.view.ts → resourceTypeView). Son las columnas de la
// tabla resource_types sin transformaciones.
export interface ResourceType {
  id: number
  name: string
  category: ResourceCategory
  unit_of_measure: string
  unit_weight_kg: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// Cuerpo de POST /resource-types (todos requeridos) y PUT /resource-types/:id
// (parcial; el PUT también admite is_active para reactivar). Espejo de
// server/src/validators/resourceTypes.validator.ts.
export interface ResourceTypePayload {
  name: string
  category: ResourceCategory
  unit_of_measure: string
  unit_weight_kg: number
  is_active?: boolean
}

// Parámetros de GET /resource-types (controller.list): filtros opcionales por
// categoría, estado activo y búsqueda por nombre, con paginación.
export interface ResourceTypeListParams {
  page: number
  limit: number
  category?: ResourceCategory
  is_active?: boolean
  search?: string
}
