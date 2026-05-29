import axios from 'axios'
import type { ApiErrorBody } from '@/types/api.types'

// El backend SIGAH responde los errores en dos formas:
//  - Validación (400):   { success:false, errors:[{ field, message }] }
//  - Operacional (SH4xx): { success:false, message, code? }
// Este helper extrae un mensaje legible para mostrar en un toast.
interface ValidationErrorBody {
  errors?: { field: string; message: string }[]
}

export function apiErrorMessage(err: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as (ApiErrorBody & ValidationErrorBody) | undefined
    if (data?.errors?.length) return data.errors.map((e) => e.message).join('. ')
    if (data?.message) return data.message
  }
  return fallback
}

// Código de estado HTTP de un error axios (para distinguir 409/422/404, etc.).
export function apiErrorStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined
}
