import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import './index.css'
import App from './App.vue'
import router from './router'
import { queryClient } from './lib/queryClient'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')

// PWA: registra el service worker (app shell + caché offline). Solo en producción;
// en dev interferiría con el HMR de Vite. La cola de escrituras la maneja Dexie.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
