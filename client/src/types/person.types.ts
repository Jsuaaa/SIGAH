export type Gender = 'M' | 'F' | 'OTRO'

export type Relationship = 'ESPOSO_A' | 'HIJO_A' | 'PADRE_MADRE' | 'HERMANO_A' | 'OTRO'

export type SpecialCondition = 'CHILD_UNDER_5' | 'ELDERLY_OVER_65' | 'PREGNANT' | 'DISABLED'

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
  { value: 'OTRO', label: 'Otro' },
]

export const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'ESPOSO_A', label: 'Esposo/a' },
  { value: 'HIJO_A', label: 'Hijo/a' },
  { value: 'PADRE_MADRE', label: 'Padre/Madre' },
  { value: 'HERMANO_A', label: 'Hermano/a' },
  { value: 'OTRO', label: 'Otro' },
]

export const SPECIAL_CONDITION_OPTIONS: { value: SpecialCondition; label: string }[] = [
  { value: 'CHILD_UNDER_5', label: 'Menor de 5 años' },
  { value: 'ELDERLY_OVER_65', label: 'Adulto mayor de 65' },
  { value: 'PREGNANT', label: 'Embarazada' },
  { value: 'DISABLED', label: 'Discapacidad' },
]

export const GENDER_LABELS = Object.fromEntries(
  GENDER_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Gender, string>

export const RELATIONSHIP_LABELS = Object.fromEntries(
  RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Relationship, string>

export const SPECIAL_CONDITION_LABELS = Object.fromEntries(
  SPECIAL_CONDITION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SpecialCondition, string>

export interface Person {
  id: number
  family_id: number
  name: string
  document: string
  birth_date: string
  age: number
  gender: Gender
  relationship: Relationship
  special_conditions: SpecialCondition[]
  requires_medication: boolean
  created_at: string
  updated_at: string
}

// Cuerpo de POST /persons (HU-05). Editar/eliminar recalcula los conteos y el
// puntaje de la familia en el backend.
export interface PersonPayload {
  family_id: number
  name: string
  document: string
  birth_date: string
  gender: Gender
  relationship: Relationship
  special_conditions?: SpecialCondition[]
  requires_medication?: boolean
}
