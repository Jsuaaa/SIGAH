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
        // Familias (HU-06 lista; HU-04/HU-08 pendientes como stub).
        {
          path: 'families',
          name: 'families',
          component: () => import('@/pages/families/FamiliesListPage.vue'),
        },
        {
          path: 'families/new',
          name: 'family-new',
          component: () => import('@/pages/families/FamilyFormPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'] },
        },
        {
          path: 'families/:id',
          name: 'family-detail',
          component: () => import('@/pages/families/FamilyDetailPage.vue'),
        },
        {
          path: 'families/:id/edit',
          name: 'family-edit',
          component: () => import('@/pages/families/FamilyFormPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'] },
        },
        // Búsqueda de personas por documento (HU-06).
        {
          path: 'persons/search',
          name: 'person-search',
          component: () => import('@/pages/persons/PersonSearchPage.vue'),
        },
        // Gestión de usuarios (HU-01/03): solo ADMIN.
        {
          path: 'users',
          name: 'users',
          component: () => import('@/pages/users/UsersPage.vue'),
          meta: { roles: ['ADMIN'] },
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
        // Logística — Bodegas e Inventario (HU-11/14/15/16/17).
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
        {
          path: 'inventory/summary',
          name: 'inventory-summary',
          component: () => import('@/pages/inventory/InventorySummaryPage.vue'),
        },
        {
          path: 'inventory/resource-types',
          name: 'resource-types',
          component: () => import('@/pages/inventory/ResourceTypesPage.vue'),
        },
        {
          path: 'inventory/alerts',
          name: 'inventory-alerts',
          component: () => import('@/pages/inventory/InventoryAlertsPage.vue'),
        },
        {
          path: 'settings/alerts',
          name: 'settings-alerts',
          component: () => import('@/pages/settings/AlertThresholdsPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Ayudas — Donantes y Donaciones (HU-18/19/20). Lectura para editores +
        // FUNCIONARIO_CONTROL (consulta); el alta solo para editores.
        {
          path: 'donors',
          name: 'donors',
          component: () => import('@/pages/donors/DonorsListPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES', 'FUNCIONARIO_CONTROL'] },
        },
        {
          path: 'donors/:id',
          name: 'donor-detail',
          component: () => import('@/pages/donors/DonorDetailPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES', 'FUNCIONARIO_CONTROL'] },
        },
        {
          path: 'donations',
          name: 'donations',
          component: () => import('@/pages/donations/DonationsListPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES', 'FUNCIONARIO_CONTROL'] },
        },
        {
          path: 'donations/new',
          name: 'donation-new',
          component: () => import('@/pages/donations/DonationFormPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] },
        },
        // Entregas (HU-22/23/12). Rutas estáticas antes de :id.
        {
          path: 'deliveries',
          name: 'deliveries',
          component: () => import('@/pages/deliveries/DeliveriesListPage.vue'),
        },
        {
          path: 'deliveries/new',
          name: 'delivery-new',
          component: () => import('@/pages/deliveries/DeliveryFormPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'] },
        },
        {
          path: 'deliveries/batch',
          name: 'delivery-batch',
          component: () => import('@/pages/deliveries/DeliveryBatchPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Priorización (HU-08): ranking + editor de pesos del puntaje.
        {
          path: 'deliveries/ranking',
          name: 'ranking',
          component: () => import('@/pages/deliveries/RankingPage.vue'),
        },
        {
          path: 'deliveries/:id',
          name: 'delivery-detail',
          component: () => import('@/pages/deliveries/DeliveryDetailPage.vue'),
        },
        {
          path: 'settings/scoring',
          name: 'settings-scoring',
          component: () => import('@/pages/settings/ScoringConfigPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Planes de distribución (HU-21).
        {
          path: 'distribution-plans',
          name: 'distribution-plans',
          component: () => import('@/pages/distributionPlans/DistributionPlansListPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        {
          path: 'distribution-plans/new',
          name: 'distribution-plan-new',
          component: () => import('@/pages/distributionPlans/DistributionPlanFormPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        {
          path: 'distribution-plans/:id',
          name: 'distribution-plan-detail',
          component: () => import('@/pages/distributionPlans/DistributionPlanDetailPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Operaciones — Vectores sanitarios (HU-25/26) y Traslados (HU-24).
        {
          path: 'health/vectors',
          name: 'health-vectors',
          component: () => import('@/pages/health/HealthVectorsPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        {
          path: 'relocations',
          name: 'relocations',
          component: () => import('@/pages/relocations/RelocationsPage.vue'),
          meta: { roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
        },
        // Mapa operativo con capas (HU-13/26/30).
        {
          path: 'map',
          name: 'map',
          component: () => import('@/pages/map/MapPage.vue'),
        },
        // Las demas rutas se agregan aqui a medida que se implementan las HU.
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
