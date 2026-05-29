import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

// Fix de iconos por defecto de Leaflet con bundlers (Vite no resuelve las rutas
// relativas a las imágenes del marcador). Mergeamos las URLs ya procesadas por
// Vite en las opciones por defecto del icono.
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

// Exponemos esta única instancia en window.L para que @vue-leaflet/vue-leaflet
// (useGlobalLeaflet) la reutilice en lugar de empaquetar una segunda copia de
// Leaflet (~150 kB). Importar este módulo una vez (por efecto secundario) basta.
declare global {
  interface Window {
    L: typeof L
  }
}
window.L = L

export default L
