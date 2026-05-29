// Tipos del módulo de personas (integrantes de familia). Reflejan el contrato del
// backend (server/src/types/entities.ts): enums Gender / Relationship /
// SpecialCondition y la forma de POST/PUT /persons.

import type { FamilyStatus } from './family.types'

export type Gender = 'M' | 'F' | 'OTRO'

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'OTRO', label: 'Otro' },
]

export const GENDER_LABELS = Object.fromEntries(
  GENDER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Gender, string>

export type Relationship = 'ESPOSO_A' | 'HIJO_A' | 'PADRE_MADRE' | 'HERMANO_A' | 'OTRO'

export const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'ESPOSO_A', label: 'Cónyuge' },
  { value: 'HIJO_A', label: 'Hijo/a' },
  { value: 'PADRE_MADRE', label: 'Padre/Madre' },
  { value: 'HERMANO_A', label: 'Hermano/a' },
  { value: 'OTRO', label: 'Otro' },
]

export const RELATIONSHIP_LABELS = Object.fromEntries(
  RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Relationship, string>

// El backend dejó REQUIRES_MEDICATION fuera del enum: el requerimiento de
// medicación va por el booleano `requires_medication`, no por este arreglo.
export type SpecialCondition = 'CHILD_UNDER_5' | 'ELDERLY_OVER_65' | 'PREGNANT' | 'DISABLED'

export const SPECIAL_CONDITION_OPTIONS: { value: SpecialCondition; label: string }[] = [
  { value: 'CHILD_UNDER_5', label: 'Menor de 5 años' },
  { value: 'ELDERLY_OVER_65', label: 'Mayor de 65 años' },
  { value: 'PREGNANT', label: 'Gestante' },
  { value: 'DISABLED', label: 'En situación de discapacidad' },
]

export const SPECIAL_CONDITION_LABELS = Object.fromEntries(
  SPECIAL_CONDITION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SpecialCondition, string>

export interface Person {
  id: number
  family_id: number
  name: string
  document: string
  birth_date: string // pg DATE → 'YYYY-MM-DD'
  gender: Gender
  relationship: Relationship
  special_conditions: SpecialCondition[]
  requires_medication: boolean
  created_at: string
  updated_at: string
}

// Cuerpo de POST /persons. En PUT, todos los campos salvo family_id son opcionales
// (family_id no se reasigna al editar).
export interface PersonPayload {
  family_id: number
  name: string
  document: string
  birth_date: string
  gender: Gender
  relationship: Relationship
  special_conditions: SpecialCondition[]
  requires_medication: boolean
}

// GET /persons/search?document= devuelve la persona junto a su familia.
export interface PersonWithFamily {
  person: Person
  family: {
    id: number
    family_code: string
    head_document: string
    zone_id: number
    shelter_id: number | null
    num_members: number
    status: FamilyStatus
  }
}

// Edad en años cumplidos a partir de la fecha de nacimiento 'YYYY-MM-DD'.
export function ageFromBirthDate(birthDate: string): number {
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return 0
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}
