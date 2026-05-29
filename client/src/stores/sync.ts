import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ConnectionStatus = 'online' | 'offline' | 'syncing'

// Estado de conexion y de la cola offline (alimenta el ConnectionBadge).
// La cola real (Dexie) se implementa en lib/offlineQueue.ts (HU-04, HU-22).
export const useSyncStore = defineStore('sync', () => {
  const status = ref<ConnectionStatus>(navigator.onLine ? 'online' : 'offline')
  const pendingCount = ref(0)
  const lastSyncAt = ref<string | null>(null)

  function setStatus(next: ConnectionStatus) {
    status.value = next
  }

  function setPendingCount(n: number) {
    pendingCount.value = n
  }

  function markSynced(at: string) {
    lastSyncAt.value = at
  }

  return { status, pendingCount, lastSyncAt, setStatus, setPendingCount, markSynced }
})
