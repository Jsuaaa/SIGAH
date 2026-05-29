# SIGAH — Client (Vue 3)

SPA mobile-first / PWA del monolito SIGAH. Consume la API REST en `/api/v1`.

## Stack

- **Vue 3.5** (Composition API, `<script setup lang="ts">`) + **Vite 8** + **TypeScript strict**
- **Vue Router** (layouts + guards) · **Pinia** (auth + sync)
- **@tanstack/vue-query** (estado servidor) · **VeeValidate + Zod** (formularios)
- **Tailwind CSS 4** · **@headlessui/vue** · **lucide-vue-next** · **vue-sonner**
- **@tanstack/vue-table** · **vue-chartjs** (Chart.js) · **@vue-leaflet/vue-leaflet** (mapas)
- **Axios** (interceptor JWT, 401, `Idempotency-Key`)

## Scripts

```bash
pnpm dev        # Vite dev server (5173), proxy /api -> :3000
pnpm build      # vue-tsc -b && vite build (genera dist/)
pnpm preview    # Previsualiza el build
pnpm lint       # ESLint
pnpm typecheck  # vue-tsc -b
```

Desde la raíz del monolito: `pnpm dev` levanta server (3000) + client (5173) concurrentes.

## Estructura

```
src/
├── main.ts                 # createApp + pinia + router + vue-query
├── App.vue                 # <RouterView/> + <Toaster/>
├── index.css               # Tailwind + design tokens (@theme)
├── router/                 # Rutas + guards (auth, password_must_change)
├── stores/                 # Pinia: auth, sync (reemplaza React Context)
├── composables/            # Lógica reutilizable (useConnection, vue-query wrappers)
├── api/                    # Axios + módulos por dominio (auth.api, ...)
├── types/                  # Tipos compartidos
├── schemas/                # Esquemas Zod
├── utils/                  # constants, formatters, mapConfig, rolePermissions
├── lib/                    # queryClient, leafletSetup, offlineQueue (Dexie), syncManager
├── components/
│   ├── layout/             # AppLayout, AppNavbar, AppSidebar, ConnectionBadge
│   ├── ui/                 # DataTable, KpiCard, StatusBadge, ScoreBreakdown...
│   ├── form/               # FormField, MapPicker, PrivacyConsentCheckbox...
│   ├── map/                # MapContainer, LayerToggle, ZonesHighlight...
│   └── auth/               # RoleGate, guards de UI
└── pages/                  # Una carpeta por módulo (ver HistoriasDeUsuario.json)
```

> Las pantallas y componentes pendientes están guiados por `HistoriasDeUsuario.json` (raíz del repo) y el prompt de diseño.
