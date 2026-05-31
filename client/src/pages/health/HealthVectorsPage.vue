<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Trash2, Activity, RotateCcw, ChevronLeft, ChevronRight, RefreshCw,
} from '@lucide/vue'
import { useHealthVectors, useHealthVectorMutations } from '@/composables/useHealthVectors'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import {
  VECTOR_TYPE_OPTIONS, VECTOR_TYPE_LABELS,
  HEALTH_VECTOR_STATUS_OPTIONS, HEALTH_VECTOR_STATUS_LABELS, HEALTH_VECTOR_STATUS_BADGE,
} from '@/types/healthVector.types'
import type {
  HealthVector, HealthVectorListParams, HealthVectorCreatePayload, HealthVectorUpdatePayload,
  HealthVectorStatusPayload, HealthVectorStatus, VectorType,
} from '@/types/healthVector.types'
import { RISK_LEVEL_OPTIONS, type RiskLevel } from '@/types/zone.types'
import { healthVectorSchema, healthVectorStatusSchema } from '@/schemas/healthVector.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
// HU-25: reportar / gestionar vectores restringido a admin y logística.
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const
// Eliminación física: solo ADMIN (alineado con la ruta del backend).
const DELETE_ROLES = ['ADMIN'] as const

// --- Filtros + listado --------------------------------------------------------
const statusFilter = ref('')
const typeFilter = ref('')
const zoneFilter = ref('')
const page = ref(1)

const params = computed<HealthVectorListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(statusFilter.value ? { status: statusFilter.value as HealthVectorStatus } : {}),
  ...(typeFilter.value ? { vector_type: typeFilter.value as VectorType } : {}),
  ...(zoneFilter.value ? { zone_id: Number(zoneFilter.value) } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useHealthVectors(params)
const { data: zones } = useZones()
const { data: shelters } = useShelters()

const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const shelterMap = computed(() => new Map((shelters.value ?? []).map((s) => [s.id, s])))

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(statusFilter.value || typeFilter.value || zoneFilter.value))

const statusFilterOptions = [
  { value: '', label: 'Todos los estados' },
  ...HEALTH_VECTOR_STATUS_OPTIONS,
]
const typeFilterOptions = [
  { value: '', label: 'Todos los tipos' },
  ...VECTOR_TYPE_OPTIONS,
]
const zoneFilterOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])

const columns = [
  { key: 'type', label: 'Tipo' },
  { key: 'risk', label: 'Riesgo' },
  { key: 'status', label: 'Estado' },
  { key: 'location', label: 'Ubicación' },
  { key: 'date', label: 'Reportado' },
  { key: 'actions', label: '', align: 'right' as const },
]

const asVector = (r: unknown) => r as HealthVector

function fmtDate(d: string) {
  const date = new Date(d)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}
// Texto de ubicación: zona y/o refugio (snapshot embebido o catálogo), o coords.
function locationText(v: HealthVector) {
  const parts: string[] = []
  const zoneName = v.zone?.name ?? (v.zone_id != null ? zoneMap.value.get(v.zone_id)?.name : undefined)
  const shelterName =
    v.shelter?.name ?? (v.shelter_id != null ? shelterMap.value.get(v.shelter_id)?.name : undefined)
  if (zoneName) parts.push(`Zona: ${zoneName}`)
  if (shelterName) parts.push(`Refugio: ${shelterName}`)
  if (parts.length) return parts.join(' · ')
  if (v.latitude != null && v.longitude != null) {
    return `${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`
  }
  return '—'
}

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  statusFilter.value = ''
  typeFilter.value = ''
  zoneFilter.value = ''
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, setStatus, remove } = useHealthVectorMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)

const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})

function blankForm() {
  return {
    vector_type: '' as VectorType | '',
    risk_level: '' as RiskLevel | '',
    description: '',
    zone_id: '',
    shelter_id: '',
    latitude: null as number | null,
    longitude: null as number | null,
  }
}
const form = ref(blankForm())

const vectorTypeFormOptions = [
  { value: '', label: 'Selecciona el tipo…' },
  ...VECTOR_TYPE_OPTIONS,
]
const riskLevelFormOptions = [
  { value: '', label: 'Selecciona el nivel…' },
  ...RISK_LEVEL_OPTIONS,
]
const zoneFormOptions = computed(() => [
  { value: '', label: 'Sin zona' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const shelterFormOptions = computed(() => [
  { value: '', label: 'Sin refugio' },
  ...(shelters.value ?? []).map((s) => ({ value: String(s.id), label: s.name })),
])

function openCreate() {
  editId.value = null
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function openEdit(v: HealthVector) {
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
  const res = validate(healthVectorSchema, {
    vector_type: form.value.vector_type,
    risk_level: form.value.risk_level,
    description: form.value.description,
    zone_id: form.value.zone_id,
  })
  const errs: Record<string, string> = res.ok ? {} : { ...res.errors }

  // RN/HU-25 (SH422): se exige al menos zona, refugio o coordenadas.
  const hasZone = !!form.value.zone_id
  const hasShelter = !!form.value.shelter_id
  const hasCoords = form.value.latitude != null && form.value.longitude != null
  if (!hasZone && !hasShelter && !hasCoords) {
    errs.location = 'Indica al menos una zona, un refugio o una ubicación en el mapa.'
  }
  errors.value = errs
  if (!res.ok || errs.location) return

  const zoneId = form.value.zone_id ? Number(form.value.zone_id) : null
  const shelterId = form.value.shelter_id ? Number(form.value.shelter_id) : null

  try {
    if (editId.value != null) {
      const payload: HealthVectorUpdatePayload = {
        vector_type: res.data.vector_type,
        risk_level: res.data.risk_level,
        description: form.value.description ? form.value.description : null,
        zone_id: zoneId,
        shelter_id: shelterId,
        latitude: form.value.latitude,
        longitude: form.value.longitude,
      }
      await update.mutateAsync({ id: editId.value, payload })
      toast.success('Vector actualizado')
    } else {
      const payload: HealthVectorCreatePayload = {
        vector_type: res.data.vector_type,
        risk_level: res.data.risk_level,
        description: form.value.description ? form.value.description : null,
        zone_id: zoneId,
        shelter_id: shelterId,
        latitude: form.value.latitude,
        longitude: form.value.longitude,
      }
      await create.mutateAsync(payload)
      toast.success('Vector registrado')
    }
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Modal cambiar estado (exige actions_taken — HU-25 CA3) --------------------
const statusOpen = ref(false)
const statusTarget = ref<HealthVector | null>(null)
const statusErrors = ref<Record<string, string>>({})
const statusSaving = computed(() => setStatus.isPending.value)
function blankStatusForm() {
  return { status: '' as HealthVectorStatus | '', actions_taken: '' }
}
const statusForm = ref(blankStatusForm())

// Estados a los que se puede transicionar: desde RESUELTO no se puede reabrir.
const statusModalOptions = computed(() => {
  const current = statusTarget.value?.status
  const opts = HEALTH_VECTOR_STATUS_OPTIONS.filter((o) => {
    if (current === 'RESUELTO' && o.value !== 'RESUELTO') return false
    return true
  })
  return [{ value: '', label: 'Selecciona el nuevo estado…' }, ...opts]
})

function openStatus(v: HealthVector) {
  statusTarget.value = v
  statusForm.value = { status: v.status, actions_taken: v.actions_taken ?? '' }
  statusErrors.value = {}
  statusOpen.value = true
}
async function saveStatus() {
  if (!statusTarget.value) return
  const res = validate(healthVectorStatusSchema, {
    status: statusForm.value.status,
    actions_taken: statusForm.value.actions_taken,
  })
  statusErrors.value = res.ok ? {} : { ...res.errors }
  if (!res.ok) return

  const payload: HealthVectorStatusPayload = {
    status: res.data.status,
    actions_taken: res.data.actions_taken,
  }
  try {
    await setStatus.mutateAsync({ id: statusTarget.value.id, payload })
    toast.success('Estado actualizado')
    statusOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo actualizar el estado.'))
  }
}

// --- Eliminar (solo ADMIN) ----------------------------------------------------
const confirmOpen = ref(false)
const target = ref<HealthVector | null>(null)
function askDelete(v: HealthVector) {
  target.value = v
  confirmOpen.value = true
}
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Vector eliminado')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo eliminar el vector.'))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Focos sanitarios"
      crumb="Operaciones"
      :subtitle="total ? `${total} ${total === 1 ? 'foco registrado' : 'focos registrados'}` : 'Vectores de riesgo sanitario (agua, insectos, roedores)'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Reportar foco</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
      <SelectField v-model="zoneFilter" :options="zoneFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los focos sanitarios.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="900px">
          <template #type="{ row }">
            <div>
              <p class="font-semibold text-neutral-900">{{ VECTOR_TYPE_LABELS[asVector(row).vector_type] }}</p>
              <p v-if="asVector(row).description" class="max-w-[260px] truncate text-xs text-neutral-500" :title="asVector(row).description ?? ''">
                {{ asVector(row).description }}
              </p>
            </div>
          </template>

          <template #risk="{ row }">
            <RiskLevelBadge :level="asVector(row).risk_level" />
          </template>

          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                HEALTH_VECTOR_STATUS_BADGE[asVector(row).status],
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ HEALTH_VECTOR_STATUS_LABELS[asVector(row).status] }}
            </span>
          </template>

          <template #location="{ row }">
            <span class="text-sm text-neutral-600">{{ locationText(asVector(row)) }}</span>
          </template>

          <template #date="{ row }">
            <span class="text-neutral-700">{{ fmtDate(asVector(row).reported_date) }}</span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" title="Cambiar estado" @click="openStatus(asVector(row))">
                  <RefreshCw /> Estado
                </AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" title="Editar" @click="openEdit(asVector(row))">
                  <Pencil />
                </AppButton>
              </RoleGate>
              <RoleGate :roles="[...DELETE_ROLES]">
                <AppButton variant="ghost" size="sm" class="text-danger" title="Eliminar" @click="askDelete(asVector(row))">
                  <Trash2 />
                </AppButton>
              </RoleGate>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin focos sanitarios"
              :message="hasFilters ? 'No hay focos que coincidan con los filtros.' : 'Aún no se han reportado vectores de riesgo sanitario.'"
            >
              <template #icon><Activity /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Reportar foco</AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <!-- Paginación -->
      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>
          Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong>
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

    <!-- Modal crear / editar -->
    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar foco sanitario' : 'Reportar foco sanitario'"
      max-width="max-w-[620px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.vector_type"
            label="Tipo de vector"
            required
            :options="vectorTypeFormOptions"
            :error="errors.vector_type"
            input-id="hv-type"
          />
          <SelectField
            v-model="form.risk_level"
            label="Nivel de riesgo"
            required
            :options="riskLevelFormOptions"
            :error="errors.risk_level"
            input-id="hv-risk"
          />
        </div>

        <FormField label="Descripción" :error="errors.description" input-id="hv-desc" hint="Opcional.">
          <textarea
            id="hv-desc"
            v-model="form.description"
            class="control"
            rows="2"
            placeholder="Detalle del foco detectado."
          />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.zone_id"
            label="Zona"
            :options="zoneFormOptions"
            :error="errors.zone_id"
            input-id="hv-zone"
          />
          <SelectField
            v-model="form.shelter_id"
            label="Refugio"
            :options="shelterFormOptions"
            input-id="hv-shelter"
          />
        </div>

        <FormField
          label="Ubicación en el mapa"
          :error="errors.location"
          hint="Indica al menos una zona, un refugio o ubica el foco en el mapa."
        >
          <MapPicker v-model:latitude="form.latitude" v-model:longitude="form.longitude" height="240px" />
        </FormField>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Reportar foco' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Modal cambiar estado (exige acciones tomadas) -->
    <BaseModal
      :open="statusOpen"
      title="Actualizar estado del foco"
      max-width="max-w-[480px]"
      @close="statusOpen = false"
    >
      <div v-if="statusTarget" class="space-y-4">
        <p class="text-sm text-neutral-600">
          <strong class="text-neutral-900">{{ VECTOR_TYPE_LABELS[statusTarget.vector_type] }}</strong>
          · estado actual: {{ HEALTH_VECTOR_STATUS_LABELS[statusTarget.status] }}.
        </p>
        <p v-if="statusTarget.status === 'RESUELTO'" class="text-xs text-neutral-500">
          Un foco resuelto no puede reabrirse.
        </p>

        <SelectField
          v-model="statusForm.status"
          label="Nuevo estado"
          required
          :options="statusModalOptions"
          :error="statusErrors.status"
          input-id="hv-status"
        />

        <FormField
          label="Acciones tomadas"
          required
          :error="statusErrors.actions_taken"
          input-id="hv-actions"
          hint="Registra las acciones realizadas (obligatorio)."
        >
          <textarea
            id="hv-actions"
            v-model="statusForm.actions_taken"
            class="control"
            rows="3"
            placeholder="Describe las acciones de control aplicadas."
          />
        </FormField>
      </div>

      <template #footer>
        <AppButton variant="ghost" @click="statusOpen = false">Cancelar</AppButton>
        <AppButton :disabled="statusSaving" @click="saveStatus">
          {{ statusSaving ? 'Guardando…' : 'Actualizar estado' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación -->
    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar foco sanitario"
      :message="target ? `¿Eliminar el foco de ${VECTOR_TYPE_LABELS[target.vector_type]}? Esta acción no se puede deshacer.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
