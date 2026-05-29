import axios from 'axios'
import { enqueueOp, type OfflineEntity } from '@/lib/offlineQueue'
import { refreshPending, flushQueue } from '@/lib/syncManager'

interface SubmitArgs<T> {
  entity: OfflineEntity
  url: string // ruta completa incl. /api/v1 (la usa POST /sync para enrutar)
  payload: unknown
  clientOpId: string
  label: string
  run: () => Promise<T> // intento online (la llamada real a la API)
}

export type SubmitResult<T> = { status: 'sent'; data: T } | { status: 'queued' }

// Un error de red (request enviado, sin respuesta) ⇒ sin conexión ⇒ encolar.
// Un error con respuesta (4xx/5xx) es un error real de negocio ⇒ propagar.
function isNetworkError(e: unknown): boolean {
  return axios.isAxiosError(e) && !e.response
}

export function useOfflineSync() {
  async function submit<T>(args: SubmitArgs<T>): Promise<SubmitResult<T>> {
    if (navigator.onLine) {
      try {
        const data = await args.run()
        return { status: 'sent', data }
      } catch (e) {
        if (!isNetworkError(e)) throw e
        // Error de red: cae al encolado de abajo.
      }
    }
    await enqueueOp({
      entity: args.entity,
      method: 'POST',
      url: args.url,
      payload: args.payload,
      label: args.label,
      client_op_id: args.clientOpId,
    })
    await refreshPending()
    return { status: 'queued' }
  }

  return { submit, flushQueue }
}
