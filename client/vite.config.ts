import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Fuerza una sola copia de Leaflet (ESM): vue-leaflet importa el build UMD
      // y nuestro setup el ESM, lo que duplicaba ~150 kB. El regex exacto evita
      // afectar a sub-imports como 'leaflet/dist/leaflet.css' o las imágenes.
      { find: /^leaflet$/, replacement: 'leaflet/dist/leaflet-src.esm.js' },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      // En dev, Vite proxy-a /api al backend Express (puerto 3000).
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
