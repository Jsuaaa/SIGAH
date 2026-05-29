import axios from 'axios'

export const TOKEN_KEY = 'sigah_token'

// Instancia unica de Axios. baseURL relativa: en dev Vite proxy-a /api,
// en prod Express sirve API y frontend desde el mismo origen.
export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor de request: adjunta el JWT si existe.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de response: maneja 401 globalmente (sesion invalida/expirada).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      // Navegacion dura para evitar import circular con el router.
      if (window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

// Helper para mutaciones offline idempotentes (HU-04 censo, HU-22 entregas).
// El backend deduplica por Idempotency-Key / client_op_id.
export function idempotent(clientOpId: string) {
  return { headers: { 'Idempotency-Key': clientOpId } }
}
