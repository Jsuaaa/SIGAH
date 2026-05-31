<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/auth.types'
import SigahLogo from '@/components/SigahLogo.vue'
import {
  LayoutDashboard,
  Map,
  Users,
  Home,
  Warehouse,
  Package,
  Boxes,
  Bell,
  Truck,
  HandCoins,
  Activity,
  ArrowLeftRight,
  ClipboardList,
  BarChart3,
  Settings,
  ShieldCheck,
} from '@lucide/vue'

defineProps<{ open: boolean }>()
defineEmits<{ (e: 'close'): void }>()

const auth = useAuthStore()

interface NavItem {
  label: string
  to: string
  icon: Component
  roles?: Role[]
}
interface NavGroup {
  title: string
  items: NavItem[]
}

// Navegación por grupos (FRONTEND-PLAN §4). Items con `roles` solo se muestran
// a esos roles (RBAC: se ocultan, no se deshabilitan).
const groups: NavGroup[] = [
  {
    title: 'General',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Mapa', to: '/map', icon: Map },
    ],
  },
  {
    title: 'Censo',
    items: [
      { label: 'Familias', to: '/families', icon: Users },
      { label: 'Zonas', to: '/zones', icon: Home, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
      { label: 'Refugios', to: '/shelters', icon: Home, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
    ],
  },
  {
    title: 'Logística',
    items: [
      { label: 'Bodegas', to: '/warehouses', icon: Warehouse, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
      { label: 'Tipos de recurso', to: '/inventory/resource-types', icon: Boxes, roles: ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] },
      { label: 'Inventario', to: '/inventory/summary', icon: Package },
      { label: 'Alertas de stock', to: '/inventory/alerts', icon: Bell, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
    ],
  },
  {
    title: 'Ayudas',
    items: [
      { label: 'Entregas', to: '/deliveries', icon: Truck },
      { label: 'Planes', to: '/distribution-plans', icon: ClipboardList, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
      { label: 'Donantes', to: '/donors', icon: HandCoins, roles: ['ADMIN', 'REGISTRADOR_DONACIONES'] },
      { label: 'Donaciones', to: '/donations', icon: Package, roles: ['ADMIN', 'REGISTRADOR_DONACIONES'] },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Traslados', to: '/relocations', icon: ArrowLeftRight, roles: ['ADMIN', 'CENSADOR', 'COORDINADOR_LOGISTICA'] },
      { label: 'Vectores', to: '/health/vectors', icon: Activity, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
    ],
  },
  {
    title: 'Análisis',
    items: [{ label: 'Reportes', to: '/reports', icon: BarChart3 }],
  },
  {
    title: 'Configuración',
    items: [
      { label: 'Puntaje', to: '/settings/scoring', icon: Settings, roles: ['ADMIN', 'COORDINADOR_LOGISTICA'] },
    ],
  },
  {
    title: 'Control',
    items: [
      { label: 'Auditoría', to: '/audit', icon: ShieldCheck, roles: ['ADMIN', 'FUNCIONARIO_CONTROL'] },
      { label: 'Usuarios', to: '/users', icon: Users, roles: ['ADMIN'] },
    ],
  },
]

function canSee(item: NavItem) {
  return !item.roles || auth.hasRole(...item.roles)
}

const visibleGroups = computed(() =>
  groups.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter((g) => g.items.length > 0),
)
</script>

<template>
  <!-- Overlay en móvil/tablet -->
  <div v-if="open" class="fixed inset-0 z-30 bg-neutral-900/50 lg:hidden" @click="$emit('close')" />

  <aside
    :class="[
      'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto bg-neutral-900 text-neutral-300 transition-transform lg:static lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="flex h-14 flex-none items-center px-4">
      <SigahLogo :size="28" light wordmark />
    </div>

    <nav class="flex-1 space-y-5 px-3 pb-6">
      <div v-for="group in visibleGroups" :key="group.title">
        <p class="mb-1 px-2 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          {{ group.title }}
        </p>
        <RouterLink
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
          active-class="bg-primary-600 text-white hover:bg-primary-600"
          @click="$emit('close')"
        >
          <component :is="item.icon" class="h-4 w-4" />
          {{ item.label }}
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>
