import type { ZodType } from 'zod'

// Valida `data` contra un esquema Zod y devuelve, o bien los datos tipados, o un
// mapa { campo: mensaje } listo para mostrar bajo cada FormField. Patrón único de
// validación de formularios en la app (Zod en submit, sin VeeValidate).
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> }

export function validate<T>(schema: ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data)
  if (result.success) return { ok: true, data: result.data }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    if (!errors[key]) errors[key] = issue.message // primer error por campo
  }
  return { ok: false, errors }
}
