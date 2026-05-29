// Cola de operaciones offline en IndexedDB (Dexie) — HU-04 CA5, HU-22 CA6.
// Las mutaciones que no se pueden enviar (sin conexión) se persisten aquí y se
// reenvían al recuperar conexión vía POST /sync con dedup por client_op_id.
import Dexie, { type Table } from 'dexie'

export type OfflineEntity = 'family' | 'person' | 'delivery'

export interface PendingOp {
  id?: number
  client_op_id: string
  entity: OfflineEntity
  method: 'POST' | 'PUT' | 'DELETE'
  url: string // ruta completa incl. /api/v1 (el backend /sync enruta por url)
  payload: unknown
  label: string // descripción legible para el panel de sincronización
  created_at: string
  attempts: number
  last_error?: string
}

// El frontend rechaza acumular más de 200 ops pendientes por usuario (FRONTEND-PLAN §10).
export const MAX_PENDING_OPS = 200

class SigahOfflineDB extends Dexie {
  pendingOps!: Table<PendingOp, number>
  constructor() {
    super('sigah-offline')
    this.version(1).stores({ pendingOps: '++id, client_op_id, entity, created_at' })
  }
}

export const offlineDB = new SigahOfflineDB()

export async function countOps(): Promise<number> {
  return offlineDB.pendingOps.count()
}

export async function enqueueOp(op: Omit<PendingOp, 'id' | 'created_at' | 'attempts'>): Promise<number> {
  const count = await countOps()
  if (count >= MAX_PENDING_OPS) {
    throw new Error(`Límite de ${MAX_PENDING_OPS} operaciones offline alcanzado. Recupera la conexión para sincronizar.`)
  }
  return offlineDB.pendingOps.add({ ...op, created_at: new Date().toISOString(), attempts: 0 })
}

export async function allOps(): Promise<PendingOp[]> {
  return offlineDB.pendingOps.orderBy('created_at').toArray()
}

export async function removeOp(id: number): Promise<void> {
  await offlineDB.pendingOps.delete(id)
}

export async function updateOp(id: number, changes: Partial<PendingOp>): Promise<void> {
  await offlineDB.pendingOps.update(id, changes)
}
