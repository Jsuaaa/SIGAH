import type { Role } from '@/types/auth.types'

// Centro de Monteria para los mapas (Leaflet).
export const MONTERIA_CENTER = { lat: 8.7479, lng: -75.8814 } as const
export const MAP_DEFAULT_ZOOM = 13

// Cobertura minima de ayuda (RN-01).
export const FOOD_KG_PER_PERSON_DAY = 0.6
export const MIN_COVERAGE_DAYS = 3

// Umbral de alerta de capacidad de bodega (RN-03 / HU-11).
export const WAREHOUSE_ALERT_THRESHOLD = 0.85

export const ROLES = {
  ADMIN: 'ADMIN',
  CENSADOR: 'CENSADOR',
  OPERADOR_ENTREGAS: 'OPERADOR_ENTREGAS',
  COORDINADOR_LOGISTICA: 'COORDINADOR_LOGISTICA',
  FUNCIONARIO_CONTROL: 'FUNCIONARIO_CONTROL',
  REGISTRADOR_DONACIONES: 'REGISTRADOR_DONACIONES',
} as const satisfies Record<string, Role>

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  CENSADOR: 'Censador',
  OPERADOR_ENTREGAS: 'Operador de entregas',
  COORDINADOR_LOGISTICA: 'Coordinador de logistica',
  FUNCIONARIO_CONTROL: 'Funcionario de control',
  REGISTRADOR_DONACIONES: 'Registrador de donaciones',
}

// Mapas de color reutilizables (mantener consistencia en toda la app).
export const RISK_LEVEL_COLOR = {
  LOW: 'green',
  MEDIUM: 'amber',
  HIGH: 'orange',
  CRITICAL: 'red',
} as const

export const DELIVERY_STATUS_COLOR = {
  SCHEDULED: 'slate',
  IN_PROGRESS: 'blue',
  DELIVERED: 'green',
} as const

export const RESOURCE_CATEGORIES = [
  'FOOD',
  'BLANKET',
  'MATTRESS',
  'HYGIENE',
  'MEDICATION',
] as const
