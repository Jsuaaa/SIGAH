<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Eye, SearchX, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useAuditLogs } from '@/composables/useAuditLogs'
import { AUDIT_ACTION_OPTIONS } from '@/types/audit.types'
import type { AuditLog, AuditListParams } from '@/types/audit.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'

const PAGE_SIZE = 20
const moduleFilter = ref('')
const actionFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
watch([moduleFilter, actionFilter, dateFrom, dateTo], () => { page.value = 1 })

const params = computed<AuditListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(moduleFilter.value.trim() ? { module: moduleFilter.value.trim() } : {}),
  ...(actionFilter.value ? { action: actionFilter.value } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useAuditLogs(params)
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const hasFilters = computed(() => !!(moduleFilter.value || actionFilter.value || dateFrom.value || dateTo.value))

const actionOptions = [{ value: '', label: 'Todas las acciones' }, ...AUDIT_ACTION_OPTIONS]

const ACTION_BADGE: Record<string, string> = {
  CREATE: 'bg-success-bg text-success',
  UPDATE: 'bg-info-bg text-primary-700',
  DELETE: 'bg-danger-bg text-danger',
}
const badgeClass = (a: string) => ACTION_BADGE[a] ?? 'bg-neutral-100 text-neutral-600'

const columns = [
  { key: 'created_at', label: 'Fecha' },
  { key: 'user', label: 'Usuario' },
  { key: 'action', label: 'Acción' },
  { key: 'module', label: 'Módulo' },
  { key: 'entity', label: 'Entidad' },
  { key: 'ip', label: 'IP', mono: true },
  { key: 'actions', label: '', align: 'right' as const },
]
const asLog = (r: unknown) => r as AuditLog

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}
function goTo(p: number) { page.value = Math.min(Math.max(1, p), totalPages.value) }
function clearFilters() { moduleFilter.value = ''; actionFilter.value = ''; dateFrom.value = ''; dateTo.value = '' }

// --- Modal de detalle (diff before/after) -------------------------------------
const detailOpen = ref(false)
const detail = ref<AuditLog | null>(null)
function openDetail(l: AuditLog) { detail.value = l; detailOpen.value = true }
const pretty = (o: Record<string, unknown> | null) => (o ? JSON.stringify(o, null, 2) : '—')
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Auditoría"
      crumb="Control"
      :subtitle="total ? `${total.toLocaleString('es-CO')} registros` : 'Historial inmutable de acciones (HU-31, RNF-09)'"
    />

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="" input-id="al-mod"><input id="al-mod" v-model="moduleFilter" class="control" placeholder="Módulo (ej. families)" /></FormField>
      <SelectField v-model="actionFilter" :options="actionOptions" />
      <FormField label="" input-id="al-from"><input id="al-from" v-model="dateFrom" type="date" class="control" /></FormField>
      <FormField label="" input-id="al-to"><input id="al-to" v-model="dateTo" type="date" class="control" /></FormField>
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la auditoría.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 8" :key="n" height="40px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="900px">
          <template #created_at="{ row }"><span class="text-sm">{{ fmtDateTime(asLog(row).created_at) }}</span></template>
          <template #user="{ row }">{{ asLog(row).user_id != null ? `Usuario #${asLog(row).user_id}` : 'Sistema' }}</template>
          <template #action="{ row }">
            <span :class="['rounded-full px-2.5 py-1 text-xs font-semibold', badgeClass(asLog(row).action)]">{{ asLog(row).action }}</span>
          </template>
          <template #module="{ row }">{{ asLog(row).module }}</template>
          <template #entity="{ row }">
            {{ asLog(row).entity }}<span v-if="asLog(row).entity_id != null" class="text-neutral-400"> #{{ asLog(row).entity_id }}</span>
          </template>
          <template #ip="{ row }"><span class="text-xs">{{ asLog(row).ip_address ?? '—' }}</span></template>
          <template #actions="{ row }">
            <AppButton variant="ghost" size="sm" @click="openDetail(asLog(row))"><Eye /> Diff</AppButton>
          </template>
          <template #empty>
            <EmptyState title="Sin registros" :message="hasFilters ? 'No hay registros que coincidan con los filtros.' : 'No hay registros de auditoría.'">
              <template #icon><SearchX /></template>
              <template v-if="hasFilters" #action><AppButton variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton></template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>{{ total.toLocaleString('es-CO') }} registros</span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>

    <!-- Modal diff -->
    <BaseModal :open="detailOpen" :title="detail ? `${detail.action} · ${detail.module}` : ''" max-width="max-w-[760px]" @close="detailOpen = false">
      <div v-if="detail" class="space-y-4">
        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt class="text-neutral-500">Fecha</dt><dd class="font-medium text-neutral-900">{{ fmtDateTime(detail.created_at) }}</dd></div>
          <div><dt class="text-neutral-500">Usuario</dt><dd class="font-medium text-neutral-900">{{ detail.user_id != null ? `#${detail.user_id}` : 'Sistema' }}</dd></div>
          <div><dt class="text-neutral-500">Entidad</dt><dd class="font-medium text-neutral-900">{{ detail.entity }} #{{ detail.entity_id ?? '—' }}</dd></div>
          <div><dt class="text-neutral-500">IP</dt><dd class="font-mono text-xs text-neutral-900">{{ detail.ip_address ?? '—' }}</dd></div>
        </dl>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-1 text-xs font-semibold text-neutral-500 uppercase">Antes</p>
            <pre class="max-h-72 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">{{ pretty(detail.before) }}</pre>
          </div>
          <div>
            <p class="mb-1 text-xs font-semibold text-neutral-500 uppercase">Después</p>
            <pre class="max-h-72 overflow-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">{{ pretty(detail.after) }}</pre>
          </div>
        </div>
      </div>
      <template #footer><AppButton @click="detailOpen = false">Cerrar</AppButton></template>
    </BaseModal>
  </section>
</template>
