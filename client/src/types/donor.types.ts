// Donantes — HU-18. Espejo del ENUM donor_type del backend
// (server/src/types/entities.ts → DONOR_TYPES) y de la vista pública
// server/src/views/donor.view.ts. El valor del enum no se traduce; solo la
// etiqueta visible.

export type DonorType =
  | 'PERSONA_NATURAL'
  | 'EMPRESA'
  | 'ALCALDIA'
  | 'GOBERNACION'
  | 'ORGANIZACION';

export const DONOR_TYPE_OPTIONS: { value: DonorType; label: string }[] = [
  { value: 'PERSONA_NATURAL', label: 'Persona natural' },
  { value: 'EMPRESA', label: 'Empresa' },
  { value: 'ALCALDIA', label: 'Alcaldía' },
  { value: 'GOBERNACION', label: 'Gobernación' },
  { value: 'ORGANIZACION', label: 'Organización' },
];

export const DONOR_TYPE_LABELS = Object.fromEntries(
  DONOR_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DonorType, string>;

// Donante tal como lo devuelve GET /donors y GET /donors/:id
// (server/src/views/donor.view.ts).
export interface Donor {
  id: number;
  name: string;
  type: DonorType;
  contact: string;
  tax_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Cuerpo de POST /donors (name, type, contact requeridos) y PUT /donors/:id
// (parcial; el PUT también admite is_active para reactivar). Espejo de
// server/src/validators/donors.validator.ts.
export interface DonorPayload {
  name: string;
  type: DonorType;
  contact: string;
  tax_id?: string | null;
  is_active?: boolean;
}

// Parámetros de GET /donors (controller.list): filtros opcionales por tipo,
// estado activo y búsqueda, con paginación.
export interface DonorListParams {
  page?: number;
  limit?: number;
  type?: DonorType;
  is_active?: boolean;
  search?: string;
}
