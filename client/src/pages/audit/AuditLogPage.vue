<script setup lang="ts">
/**
 * HU-31 — Historial de auditoría (solo lectura).
 * Tabla inmutable (fecha, usuario, acción, módulo, entidad, IP) con filtros
 * (usuario, módulo, acción, rango de fechas) y diff before/after expandible con
 * JSON formateado legible. Sin controles de edición. RBAC ADMIN/FUNCIONARIO_CONTROL
 * (el router ya restringe el acceso; aquí no hay mutaciones).
 *
 * Nota: el backend devuelve solo user_id (no nombre/email). GET /users es
 * ADMIN-only, así que el catálogo de usuarios solo se carga para ADMIN y se usa
 * para mostrar el nombre cuando esté disponible; para los demás roles se muestra
 * el user_id. El filtro de usuario es un id numérico para no depender de /users.
 */
import { computed, ref, watch } from 'vue'
import {
  RotateCcw,
  SearchX,
  ScrollText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from '@lucide/vue'
import { useAuditLogs } from '@/composables/useAuditLogs'
import { useUsersList } from '@/composables/useUsers'
import { useAuthStore } from '@/stores/auth'
import type { AdminUser, UsersListParams } from '@/types/user.types'
import type { AuditLog, AuditLogFilters, AuditSnapshot } from '@/types/auditLog.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import InputField from '@/components/form/InputField.vue'

const auth = useAuthStore()
const PAGE_SIZE = 50
const fmt = (n: number | string) => Number(n).toLocaleString('es-CO')

// --- Filtros (fuente de verdad) ---
const userId = ref('')
const moduleFilter = ref('')
const action = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)

watch([userId, moduleFilter, action, dateFrom, dateTo], () => {
  page.value = 1
})

const filters = computed<AuditLogFilters>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(userId.value ? { user_id: Number(userId.value) } : {}),
  ...(moduleFilter.value ? { module: moduleFilter.value.trim() } : {}),
  ...(action.value ? { action: action.value.trim() } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useAuditLogs(filters)

// Catálogo de usuarios solo para ADMIN (el listado de usuarios es ADMIN-only):
// mapea id→nombre para mostrar el nombre en lugar del id cuando sea posible.
const isAdmin = computed(() => auth.hasRole('ADMIN'))
const usersParams = computed<UsersListParams>(() => ({ page: 1, limit: 200 }))
const { data: usersData } = useUsersList(usersParams)
const userNameById = computed(() => {
  const map = new Map<number, string>()
  if (!isAdmin.value) return map
  for (const u of (usersData.value?.data ?? []) as AdminUser[]) map.set(u.id, u.name)
  return map
})
function userLabel(id: number | null): string {
  if (id == null) return 'Sistema'
  return userNameById.value.get(id) ?? `Usuario #${id}`
}

const rows = computed<AuditLog[]>(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(
  () => !!(userId.value || moduleFilter.value || action.value || dateFrom.value || dateTo.value),
)

// --- Diff before/after expandible ---
const expanded = ref<Set<number>>(new Set())
function toggle(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
function hasDiff(row: AuditLog): boolean {
  return row.before != null || row.after != null
}
function pretty(snapshot: AuditSnapshot): string {
  if (snapshot == null) return '—'
  try {
    return JSON.stringify(snapshot, null, 2)
  } catch {
    return String(snapshot)
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const columns = [
  { key: 'expand', label: '', align: 'center' as const },
  { key: 'created_at', label: 'Fecha' },
  { key: 'user', label: 'Usuario' },
  { key: 'action', label: 'Acción' },
  { key: 'module', label: 'Módulo' },
  { key: 'entity', label: 'Entidad' },
  { key: 'ip_address', label: 'IP', mono: true },
]
const asRow = (r: unknown) => r as AuditLog

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  userId.value = ''
  moduleFilter.value = ''
  action.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Historial de auditoría"
      crumb="Analítica y control"
      :subtitle="total ? `${fmt(total)} eventos registrados` : 'Registro inmutable de cambios (HU-31)'"
    />

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-5">
      <InputField v-model="userId" label="ID de usuario" type="number" placeholder="Cualquiera" />
      <InputField v-model="moduleFilter" label="Módulo" placeholder="ej. families" />
      <InputField v-model="action" label="Acción" placeholder="ej. CREATE" />
      <InputField v-model="dateFrom" label="Desde" type="date" />
      <InputField v-model="dateTo" label="Hasta" type="date" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar el historial de auditoría.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 10" :key="n" height="40px" />
    </div>

    <!-- Datos -->
    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="920px">
          <template #expand="{ row }">
            <button
              v-if="hasDiff(asRow(row))"
              type="button"
              class="grid h-7 w-7 place-items-center rounded text-neutral-500 hover:bg-neutral-100"
              :aria-label="expanded.has(asRow(row).id) ? 'Ocultar cambios' : 'Ver cambios'"
              @click="toggle(asRow(row).id)"
            >
              <ChevronDown v-if="expanded.has(asRow(row).id)" class="h-4 w-4" />
              <ChevronRight v-else class="h-4 w-4" />
            </button>
            <span v-else class="text-neutral-300">—</span>
          </template>

          <template #created_at="{ row }">
            <span class="whitespace-nowrap text-neutral-700">{{ formatDate(asRow(row).created_at) }}</span>
          </template>

          <template #user="{ row }">
            <span class="text-neutral-800">{{ userLabel(asRow(row).user_id) }}</span>
          </template>

          <template #action="{ row }">
            <span class="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700">
              {{ asRow(row).action }}
            </span>
          </template>

          <template #entity="{ row }">
            <span class="text-neutral-700">
              {{ asRow(row).entity ?? '—' }}<span v-if="asRow(row).entity_id" class="text-neutral-400"> #{{ asRow(row).entity_id }}</span>
            </span>
          </template>

          <template #ip_address="{ row }">
            {{ asRow(row).ip_address ?? '—' }}
          </template>

          <template #empty>
            <EmptyState
              title="Sin eventos"
              :message="hasFilters ? 'No hay eventos de auditoría que coincidan con los filtros.' : 'Aún no se han registrado eventos.'"
            >
              <template #icon><SearchX /></template>
              <template v-if="hasFilters" #action>
                <AppButton variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <!-- Diffs expandidos (debajo de la tabla, por id) -->
      <div v-for="row in rows" :key="`diff-${row.id}`">
        <div
          v-if="expanded.has(row.id) && hasDiff(row)"
          class="rounded-lg border border-neutral-200 bg-white p-4"
        >
          <p class="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ScrollText class="h-4 w-4 text-neutral-400" />
            Cambios · {{ row.action }} en {{ row.module }}
            <span class="font-mono text-xs font-normal text-neutral-500">{{ formatDate(row.created_at) }}</span>
          </p>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p class="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Antes</p>
              <pre class="max-h-80 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700">{{ pretty(row.before) }}</pre>
            </div>
            <div>
              <p class="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Después</p>
              <pre class="max-h-80 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700">{{ pretty(row.after) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Paginación -->
      <div
        v-if="total > 0"
        class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600"
      >
        <span>
          Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ fmt(total) }}</strong>
        </span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
            <ChevronLeft />
          </AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
            <ChevronRight />
          </AppButton>
        </div>
      </div>
    </template>
  </section>
</template>
