<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UserPlus, ChevronLeft, ChevronRight, SearchX, Eye, RotateCcw } from '@lucide/vue'
import { useFamiliesList } from '@/composables/useFamilies'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import { FAMILY_STATUS_OPTIONS } from '@/types/family.types'
import type { Family, FamilyListParams, FamilyStatus } from '@/types/family.types'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FamilyStatusBadge from '@/components/ui/FamilyStatusBadge.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import SearchInput from '@/components/form/SearchInput.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const PAGE_SIZE = 20

// Estado de filtros (fuente de verdad sincronizada con la URL).
const q = ref((route.query.q as string) || '')
const zoneId = ref((route.query.zone_id as string) || '')
const status = ref((route.query.status as string) || '')
const shelterId = ref((route.query.shelter_id as string) || '')
const page = ref(Number(route.query.page) || 1)

watch([q, zoneId, status, shelterId], () => {
  page.value = 1
})
watch([q, zoneId, status, shelterId, page], () => {
  const query: Record<string, string> = {}
  if (q.value) query.q = q.value
  if (zoneId.value) query.zone_id = zoneId.value
  if (status.value) query.status = status.value
  if (shelterId.value) query.shelter_id = shelterId.value
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
})

const params = computed<FamilyListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(q.value ? { q: q.value } : {}),
  ...(zoneId.value ? { zone_id: Number(zoneId.value) } : {}),
  ...(shelterId.value ? { shelter_id: Number(shelterId.value) } : {}),
  ...(status.value ? { status: status.value as FamilyStatus } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useFamiliesList(params)
const { data: zones } = useZones()
const { data: shelters } = useShelters()

// Joins en cliente: Family solo trae zone_id / shelter_id.
const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const shelterMap = computed(() => new Map((shelters.value ?? []).map((s) => [s.id, s])))

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))

const searching = computed(() => !!q.value)
const hasFilters = computed(() => !!(q.value || zoneId.value || status.value || shelterId.value))

const zoneOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const statusOptions = [
  { value: '', label: 'Todos los estados' },
  ...FAMILY_STATUS_OPTIONS.map((s) => ({ value: s.value as string, label: s.label })),
]
const shelterOptions = computed(() => [
  { value: '', label: 'Todos los refugios' },
  ...(shelters.value ?? []).map((s) => ({ value: String(s.id), label: s.name })),
])

const columns = [
  { key: 'family_code', label: 'Código', mono: true },
  { key: 'head_document', label: 'Documento', mono: true },
  { key: 'zone', label: 'Zona' },
  { key: 'shelter', label: 'Refugio' },
  { key: 'num_members', label: 'Miembros', align: 'center' as const },
  { key: 'num_children_under_5', label: 'Niños <5', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'right' as const, mono: true },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '', align: 'right' as const },
]

function asFamily(r: unknown) {
  return r as Family
}
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  q.value = ''
  zoneId.value = ''
  status.value = ''
  shelterId.value = ''
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Familias"
      crumb="Censo"
      :subtitle="total ? `${total.toLocaleString('es-CO')} familias registradas` : 'Censo poblacional'"
    >
      <template #actions>
        <RoleGate :roles="['ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR']">
          <AppButton @click="router.push('/families/new')">
            <UserPlus /> Registrar familia
          </AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
      <SearchInput v-model="q" placeholder="Código, documento o dirección…" />
      <SelectField v-model="zoneId" :options="zoneOptions" :disabled="searching" />
      <SelectField v-model="status" :options="statusOptions" :disabled="searching" />
      <SelectField v-model="shelterId" :options="shelterOptions" :disabled="searching" />
      <p v-if="searching" class="text-xs text-neutral-500 md:col-span-2 lg:col-span-4">
        Búsqueda de texto activa: ignora los filtros de zona, estado y refugio.
      </p>
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las familias.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 8" :key="n" height="44px" />
    </div>

    <!-- Datos -->
    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="860px">
          <template #family_code="{ value }">
            <span class="font-semibold text-neutral-900">{{ value }}</span>
          </template>

          <template #zone="{ row }">
            <div class="flex items-center gap-2">
              <span>{{ zoneMap.get(asFamily(row).zone_id)?.name ?? '—' }}</span>
              <RiskLevelBadge
                v-if="zoneMap.get(asFamily(row).zone_id)"
                :level="zoneMap.get(asFamily(row).zone_id)!.risk_level"
              />
            </div>
          </template>

          <template #shelter="{ row }">
            {{ asFamily(row).shelter_id ? (shelterMap.get(asFamily(row).shelter_id!)?.name ?? '—') : '—' }}
          </template>

          <template #priority_score="{ value }">
            <span class="font-semibold text-neutral-900">{{ Math.round(Number(value)) }}</span>
          </template>

          <template #status="{ row }">
            <FamilyStatusBadge :status="asFamily(row).status" />
          </template>

          <template #actions="{ row }">
            <AppButton variant="ghost" size="sm" @click="router.push(`/families/${asFamily(row).id}`)">
              <Eye /> Ver
            </AppButton>
          </template>

          <template #empty>
            <EmptyState
              title="Sin resultados"
              :message="hasFilters ? 'No hay familias que coincidan con la búsqueda o los filtros.' : 'Aún no hay familias registradas.'"
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

      <!-- Paginación -->
      <div
        v-if="total > 0"
        class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600"
      >
        <span>
          Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de
          <strong>{{ total.toLocaleString('es-CO') }}</strong>
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
