<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Plus, Pencil, Trash2, Activity, RotateCcw, ChevronLeft, ChevronRight, RefreshCw } from '@lucide/vue'
import { useHealthVectorsList, useHealthVectorMutations } from '@/composables/useHealthVectors'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import {
  VECTOR_TYPE_OPTIONS, VECTOR_TYPE_LABELS, VECTOR_STATUS_OPTIONS, VECTOR_STATUS_LABELS, VECTOR_STATUS_BADGE,
} from '@/types/healthVector.types'
import type {
  HealthVectorEnriched, HealthVectorListParams, HealthVectorPayload, HealthVectorStatus, VectorType,
} from '@/types/healthVector.types'
import { RISK_LEVEL_OPTIONS } from '@/types/zone.types'
import type { RiskLevel } from '@/types/zone.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const
const DELETE_ROLES = ['ADMIN'] as const

const statusFilter = ref('')
const typeFilter = ref('')
const riskFilter = ref('')
const zoneFilter = ref('')
const page = ref(1)

const params = computed<HealthVectorListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(statusFilter.value ? { status: statusFilter.value as HealthVectorStatus } : {}),
  ...(typeFilter.value ? { vector_type: typeFilter.value as VectorType } : {}),
  ...(riskFilter.value ? { risk_level: riskFilter.value as RiskLevel } : {}),
  ...(zoneFilter.value ? { zone_id: Number(zoneFilter.value) } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useHealthVectorsList(params)
const { data: zones } = useZones()
const { data: shelters } = useShelters()
const { create, update, setStatus, remove } = useHealthVectorMutations()

const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const shelterMap = computed(() => new Map((shelters.value ?? []).map((s) => [s.id, s])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const hasFilters = computed(() => !!(statusFilter.value || typeFilter.value || riskFilter.value || zoneFilter.value))

const zoneFilterOptions = computed(() => [{ value: '', label: 'Todas las zonas' }, ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name }))])
const zoneFormOptions = computed(() => [{ value: '', label: 'Sin zona' }, ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name }))])
const shelterFormOptions = computed(() => [{ value: '', label: 'Sin refugio' }, ...(shelters.value ?? []).map((s) => ({ value: String(s.id), label: s.name }))])
const typeFilterOptions = [{ value: '', label: 'Todos los tipos' }, ...VECTOR_TYPE_OPTIONS]
const typeFormOptions = [{ value: '', label: 'Selecciona…' }, ...VECTOR_TYPE_OPTIONS]
const statusFilterOptions = [{ value: '', label: 'Todos los estados' }, ...VECTOR_STATUS_OPTIONS]
const riskFilterOptions = [{ value: '', label: 'Todos los riesgos' }, ...RISK_LEVEL_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))]
const riskFormOptions = [{ value: '', label: 'Selecciona…' }, ...RISK_LEVEL_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))]

const columns = [
  { key: 'vector_type', label: 'Vector' },
  { key: 'risk_level', label: 'Riesgo' },
  { key: 'location', label: 'Ubicación' },
  { key: 'status', label: 'Estado' },
  { key: 'reported_date', label: 'Reportado' },
  { key: 'actions', label: '', align: 'right' as const },
]
const asVector = (r: unknown) => r as HealthVectorEnriched

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function locationOf(v: HealthVectorEnriched) {
  if (v.shelter_id) return v.shelter?.name ?? shelterMap.value.get(v.shelter_id)?.name ?? 'Refugio'
  if (v.zone_id) return v.zone?.name ?? zoneMap.value.get(v.zone_id)?.name ?? 'Zona'
  return v.latitude != null ? 'Coordenadas' : '—'
}
function goTo(p: number) { page.value = Math.min(Math.max(1, p), totalPages.value) }
function clearFilters() { statusFilter.value = ''; typeFilter.value = ''; riskFilter.value = ''; zoneFilter.value = '' }

// --- Modal crear / editar -----------------------------------------------------
const saving = computed(() => create.isPending.value || update.isPending.value)
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    vector_type: '', risk_level: '', description: '',
    zone_id: '', shelter_id: '', latitude: null as number | null, longitude: null as number | null,
  }
}
const form = ref(blankForm())

function openCreate() {
  editId.value = null
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function openEdit(v: HealthVectorEnriched) {
  editId.value = v.id
  form.value = {
    vector_type: v.vector_type,
    risk_level: v.risk_level,
    description: v.description ?? '',
    zone_id: v.zone_id != null ? String(v.zone_id) : '',
    shelter_id: v.shelter_id != null ? String(v.shelter_id) : '',
    latitude: v.latitude,
    longitude: v.longitude,
  }
  errors.value = {}
  modalOpen.value = true
}
async function submit() {
  const e: Record<string, string> = {}
  if (!form.value.vector_type) e.vector_type = 'Selecciona el tipo.'
  if (!form.value.risk_level) e.risk_level = 'Selecciona el riesgo.'
  errors.value = e
  if (Object.keys(e).length) return

  const common = {
    risk_level: form.value.risk_level as RiskLevel,
    description: form.value.description.trim() || null,
    zone_id: form.value.zone_id ? Number(form.value.zone_id) : null,
    shelter_id: form.value.shelter_id ? Number(form.value.shelter_id) : null,
    latitude: form.value.latitude,
    longitude: form.value.longitude,
  }
  try {
    if (editId.value != null) {
      await update.mutateAsync({ id: editId.value, payload: common })
      toast.success('Vector actualizado')
    } else {
      const payload: HealthVectorPayload = {
        ...common,
        vector_type: form.value.vector_type as VectorType,
        reported_date: new Date().toISOString(),
      }
      await create.mutateAsync(payload)
      toast.success('Vector reportado')
    }
    modalOpen.value = false
  } catch (err) {
    toast.error(apiErrorMessage(err))
  }
}

// --- Modal de estado ----------------------------------------------------------
const statusModalOpen = ref(false)
const statusTarget = ref<HealthVectorEnriched | null>(null)
const statusValue = ref<HealthVectorStatus>('ACTIVO')
const actionsTaken = ref('')
const statusSaving = computed(() => setStatus.isPending.value)
function openStatus(v: HealthVectorEnriched) {
  statusTarget.value = v
  statusValue.value = v.status
  actionsTaken.value = v.actions_taken ?? ''
  statusModalOpen.value = true
}
async function saveStatus() {
  if (!statusTarget.value) return
  try {
    await setStatus.mutateAsync({ id: statusTarget.value.id, status: statusValue.value, actions_taken: actionsTaken.value.trim() || null })
    toast.success('Estado actualizado')
    statusModalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Eliminar -----------------------------------------------------------------
const confirmOpen = ref(false)
const target = ref<HealthVectorEnriched | null>(null)
function askDelete(v: HealthVectorEnriched) { target.value = v; confirmOpen.value = true }
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Vector eliminado')
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Vectores sanitarios"
      crumb="Operaciones"
      :subtitle="total ? `${total} ${total === 1 ? 'vector' : 'vectores'}` : 'Riesgos sanitarios reportados (HU-25/26)'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]"><AppButton @click="openCreate"><Plus /> Reportar vector</AppButton></RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
      <SelectField v-model="riskFilter" :options="riskFilterOptions" />
      <SelectField v-model="zoneFilter" :options="zoneFilterOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los vectores.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="880px">
          <template #vector_type="{ row }">
            <div>
              <p class="font-semibold text-neutral-900">{{ VECTOR_TYPE_LABELS[asVector(row).vector_type] }}</p>
              <p v-if="asVector(row).description" class="max-w-[280px] truncate text-xs text-neutral-500">{{ asVector(row).description }}</p>
            </div>
          </template>
          <template #risk_level="{ row }"><RiskLevelBadge :level="asVector(row).risk_level" /></template>
          <template #location="{ row }">{{ locationOf(asVector(row)) }}</template>
          <template #status="{ row }">
            <span :class="['inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', VECTOR_STATUS_BADGE[asVector(row).status]]">
              {{ VECTOR_STATUS_LABELS[asVector(row).status] }}
            </span>
          </template>
          <template #reported_date="{ row }">{{ fmtDate(asVector(row).reported_date) }}</template>
          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openStatus(asVector(row))"><RefreshCw /> Estado</AppButton>
                <AppButton variant="ghost" size="sm" @click="openEdit(asVector(row))"><Pencil /></AppButton>
              </RoleGate>
              <RoleGate :roles="[...DELETE_ROLES]">
                <AppButton variant="ghost" size="sm" class="text-danger" @click="askDelete(asVector(row))"><Trash2 /></AppButton>
              </RoleGate>
            </div>
          </template>
          <template #empty>
            <EmptyState :message="hasFilters ? 'No hay vectores que coincidan con los filtros.' : 'No hay vectores sanitarios reportados.'" title="Sin vectores">
              <template #icon><Activity /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]"><AppButton size="sm" @click="openCreate"><Plus /> Reportar vector</AppButton></RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>{{ total }} en total</span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>

    <!-- Modal crear / editar -->
    <BaseModal :open="modalOpen" :title="editId != null ? 'Editar vector' : 'Reportar vector'" max-width="max-w-[620px]" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField v-model="form.vector_type" label="Tipo de vector" required :options="typeFormOptions" :error="errors.vector_type" :disabled="editId != null" input-id="hv-type" />
          <SelectField v-model="form.risk_level" label="Nivel de riesgo" required :options="riskFormOptions" :error="errors.risk_level" input-id="hv-risk" />
        </div>
        <FormField label="Descripción" input-id="hv-desc" hint="Opcional">
          <textarea id="hv-desc" v-model="form.description" rows="2" class="control" placeholder="Detalle del riesgo…" />
        </FormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField v-model="form.zone_id" label="Zona" :options="zoneFormOptions" input-id="hv-zone" />
          <SelectField v-model="form.shelter_id" label="Refugio" :options="shelterFormOptions" input-id="hv-shelter" />
        </div>
        <FormField label="Ubicación exacta" hint="Opcional. Toca el mapa para marcar el punto.">
          <MapPicker v-model:latitude="form.latitude" v-model:longitude="form.longitude" height="220px" />
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">{{ saving ? 'Guardando…' : editId != null ? 'Guardar' : 'Reportar' }}</AppButton>
      </template>
    </BaseModal>

    <!-- Modal de estado -->
    <BaseModal :open="statusModalOpen" title="Actualizar estado" max-width="max-w-[460px]" @close="statusModalOpen = false">
      <div class="space-y-4">
        <SelectField v-model="statusValue" label="Estado" :options="VECTOR_STATUS_OPTIONS" input-id="hv-st" />
        <FormField label="Acciones tomadas" input-id="hv-actions" hint="Opcional">
          <textarea id="hv-actions" v-model="actionsTaken" rows="3" class="control" placeholder="Describe las acciones realizadas…" />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="statusModalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="statusSaving" @click="saveStatus">{{ statusSaving ? 'Guardando…' : 'Actualizar' }}</AppButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar vector"
      :message="target ? `¿Eliminar el vector “${VECTOR_TYPE_LABELS[target.vector_type]}”? Esta acción no se puede deshacer.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
