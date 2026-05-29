export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Envelope estándar del backend SIGAH.
export interface ApiList<T> {
  success: boolean
  data: T[]
  pagination: PaginationMeta
}

export interface ApiItem<T> {
  success: boolean
  data: T
}

export interface ApiErrorBody {
  success?: boolean
  message: string
  // Códigos tipados del backend: SH401/SH403/SH404/SH409/SH422/SH423.
  code?: string
}
