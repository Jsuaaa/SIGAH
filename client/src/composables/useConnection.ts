import { onMounted, onUnmounted } from 'vue'
import { useSyncStore } from '@/stores/sync'

// Sincroniza el estado online/offline del navegador con el sync store.
// El disparo del flush de la cola offline se conectara aqui (syncManager).
export function useConnection() {
  const sync = useSyncStore()

  function goOnline() {
    sync.setStatus('online')
  }
  function goOffline() {
    sync.setStatus('offline')
  }

  onMounted(() => {
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', goOnline)
    window.removeEventListener('offline', goOffline)
  })

  return { sync }
}
