import { onMounted, onUnmounted } from 'vue'
import { useSyncStore } from '@/stores/sync'
import { flushQueue, refreshPending } from '@/lib/syncManager'

// Sincroniza el estado online/offline del navegador con el sync store y dispara
// el flush de la cola offline al recuperar conexión (HU-04 CA5, HU-22 CA6).
export function useConnection() {
  const sync = useSyncStore()

  function goOnline() {
    sync.setStatus('online')
    void flushQueue()
  }
  function goOffline() {
    sync.setStatus('offline')
  }

  onMounted(() => {
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Inicializa el contador de pendientes y vacía la cola si arrancamos online.
    void refreshPending().then(() => {
      if (navigator.onLine) void flushQueue()
    })
  })

  onUnmounted(() => {
    window.removeEventListener('online', goOnline)
    window.removeEventListener('offline', goOffline)
  })

  return { sync }
}
