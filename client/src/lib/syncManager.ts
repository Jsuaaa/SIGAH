// Flush de la cola offline: reenvía las ops pendientes a POST /sync y reconcilia
// la cola según el status_code de cada resultado. HU-04 CA5, HU-22 CA6.
import { allOps, countOps, removeOp, updateOp } from './offlineQueue'
import { syncApi } from '@/api/sync.api'
import { useSyncStore } from '@/stores/sync'
import { queryClient } from './queryClient'

let flushing = false

// Sincroniza el contador de pendientes con la cola (para el ConnectionBadge).
export async function refreshPending(): Promise<number> {
  const n = await countOps()
  useSyncStore().setPendingCount(n)
  return n
}

export async function flushQueue(): Promise<{ sent: number; failed: number } | null> {
  if (flushing || !navigator.onLine) return null
  const sync = useSyncStore()
  const ops = await allOps()
  if (!ops.length) {
    sync.setPendingCount(0)
    return null
  }

  flushing = true
  sync.setStatus('syncing')
  try {
    const results = await syncApi.processBatch(
      ops.map((o) => ({ client_op_id: o.client_op_id, method: o.method, url: o.url, payload: o.payload })),
    )
    const byKey = new Map(ops.map((o) => [o.client_op_id, o]))
    let sent = 0
    let failed = 0

    for (const r of results) {
      const op = byKey.get(r.client_op_id)
      if (!op?.id) continue
      if (r.status_code < 400 || r.from_cache) {
        await removeOp(op.id)
        sent++
      } else if (r.status_code < 500) {
        // Falla permanente (validación/conflicto): no reintentar — quitar y reportar.
        await removeOp(op.id)
        failed++
      } else {
        // 5xx: reintentable; conserva e incrementa intentos.
        await updateOp(op.id, { attempts: op.attempts + 1, last_error: `Error ${r.status_code}` })
      }
    }

    // Refresca los datos que pudieron cambiar al aplicar las ops.
    queryClient.invalidateQueries({ queryKey: ['families'] })
    queryClient.invalidateQueries({ queryKey: ['deliveries'] })
    queryClient.invalidateQueries({ queryKey: ['prioritization'] })
    queryClient.invalidateQueries({ queryKey: ['warehouses'] })

    await refreshPending()
    sync.markSynced(new Date().toISOString())
    sync.setStatus(navigator.onLine ? 'online' : 'offline')
    return { sent, failed }
  } catch {
    // El POST /sync falló (probablemente se perdió la conexión): conserva la cola.
    sync.setStatus(navigator.onLine ? 'online' : 'offline')
    return null
  } finally {
    flushing = false
  }
}
