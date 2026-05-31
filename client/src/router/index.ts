import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/auth.types'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/pages/auth/ChangePasswordPage.vue'),
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/DashboardPage.vue'),
        },
        // Familias (HU-04/05/06/07/08).
        {
          path: 'families',
          name: 'families',
          component: () => import('@/pages/families/FamiliesListPage.vue'),
        },
        {
          path: 'families/new',
          name: 'family-new',
          component: () => import('@/pages/families/FamilyFormPage.vue'),
          // HU-04 CA6: censo restringido a censadores y coordinación.
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'] },
        },
        {
          path: 'families/:id',
          name: 'family-detail',
          component: () => import('@/pages/families/FamilyDetailPage.vue'),
        },
        // Zonas (HU-09) y Refugios (HU-10): CRUD restringido a ADMIN/COORDINADOR.
        {
          path: 'zones',
          name: 'zones',
          component: () => import('@/pages/zones/ZonesListPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        {
          path: 'zones/:id',
          name: 'zone-detail',
          component: () => import('@/pages/zones/ZoneDetailPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        {
          path: 'shelters',
          name: 'shelters',
          component: () => import('@/pages/shelters/SheltersListPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Bodegas (HU-11): CRUD restringido a ADMIN/COORDINADOR_LOGISTICA.
        {
          path: 'warehouses',
          name: 'warehouses',
          component: () => import('@/pages/warehouses/WarehousesListPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        {
          path: 'warehouses/:id',
          name: 'warehouse-detail',
          component: () => import('@/pages/warehouses/WarehouseDetailPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Inventario (HU-15): consulta de existencias por bodega/categoría.
        {
          path: 'inventory/summary',
          name: 'inventory-summary',
          component: () => import('@/pages/inventory/InventorySummaryPage.vue'),
          meta: {
            roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS', 'REGISTRADOR_DONACIONES'],
          },
        },
        // Tipos de recurso (HU-14): catálogo gestionable por logística y donaciones.
        {
          path: 'inventory/resource-types',
          name: 'resource-types',
          component: () => import('@/pages/inventory/ResourceTypesPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] },
        },
        // Alertas de stock (HU-16): ver alertas (lectura amplia) + editar umbrales
        // (auto-restringido a ADMIN/COORDINADOR dentro de la página con RoleGate).
        {
          path: 'inventory/alerts',
          name: 'inventory-alerts',
          component: () => import('@/pages/inventory/InventoryAlertsPage.vue'),
          meta: {
            roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS', 'REGISTRADOR_DONACIONES'],
          },
        },
        {
          path: 'settings/alerts',
          name: 'settings-alerts',
          component: () => import('@/pages/inventory/InventoryAlertsPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Donantes (HU-18): CRUD para ADMIN/REGISTRADOR_DONACIONES.
        {
          path: 'donors',
          name: 'donors',
          component: () => import('@/pages/donors/DonorsListPage.vue'),
          meta: { roles: ['ADMIN', 'REGISTRADOR_DONACIONES'] },
        },
        // Donaciones (HU-19): registro con items y bodega destino.
        {
          path: 'donations',
          name: 'donations',
          component: () => import('@/pages/donations/DonationsListPage.vue'),
          meta: { roles: ['ADMIN', 'REGISTRADOR_DONACIONES'] },
        },
        {
          path: 'donations/new',
          name: 'donation-new',
          component: () => import('@/pages/donations/DonationFormPage.vue'),
          meta: { roles: ['ADMIN', 'REGISTRADOR_DONACIONES'] },
        },
        // Gestión de usuarios (HU-01): solo ADMIN.
        {
          path: 'users',
          name: 'users',
          component: () => import('@/pages/users/UsersPage.vue'),
          meta: { roles: ['ADMIN'] },
        },
        // Las demas rutas (entregas, donaciones, mapa, etc.) se agregan aqui
        // a medida que se implementan las HU. Ver HistoriasDeUsuario.json.
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
})

// Guard global: autenticacion, hidratacion del perfil, cambio obligatorio de
// contrasena (HU-02, HU-03) y autorizacion por rol (meta.roles, FRONTEND-PLAN §5).
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const isPublic = to.meta.public === true

  if (!isPublic && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isPublic && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }

  // Tras un refresh hay token pero el perfil (rol) aun no esta en memoria: lo
  // hidratamos antes de evaluar permisos. Un 401 ya lo maneja el interceptor.
  if (auth.isAuthenticated && !auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  if (auth.isAuthenticated && auth.mustChangePassword && to.name !== 'change-password') {
    return { name: 'change-password' }
  }

  // Autorizacion por rol: ademas de ocultar el item en la sidebar, bloquea el
  // acceso directo por URL para roles no autorizados.
  const roles = to.meta.roles as Role[] | undefined
  if (roles && auth.user && !auth.hasRole(...roles)) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
