<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Trash2, Users, SearchX, RotateCcw, ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useSheltersList, useShelterMutations } from '@/composables/useShelters'
import { useZones } from '@/composables/useZones'
import { SHELTER_TYPE_OPTIONS, SHELTER_TYPE_LABELS } from '@/types/shelter.types'
import type { ShelterListParams, ShelterPayload, ShelterType, ShelterWithOccupancy } from '@/types/shelter.types'
import { shelterSchema } from '@/schemas/shelter.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SearchInput from '@/components/form/SearchInput.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const
const OCCUPANCY_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'] as const

// --- Filtros + listado --------------------------------------------------------
const search = ref('')
const zoneFilter = ref('')
const typeFilter = ref('')
const page = ref(1)

const params = computed<ShelterListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(search.value ? { search: search.value } : {}),
  ...(zoneFilter.value ? { zone_id: Number(zoneFilter.value) } : {}),
  ...(typeFilter.value ? { type: typeFilter.value as ShelterType } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useSheltersList(params)
const { data: zones } = useZones()

const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(search.value || zoneFilter.value || typeFilter.value))

const zoneFilterOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const zoneFormOptions = computed(() => [
  { value: '', label: 'Selecciona la zona…' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const typeFilterOptions = [{ value: '', label: 'Todos los tipos' }, ...SHELTER_TYPE_OPTIONS]
const typeFormOptions = [{ value: '', label: 'Selecciona el tipo…' }, ...SHELTER_TYPE_OPTIONS]

const columns = [
  { key: 'name', label: 'Refugio' },
  { key: 'zone', label: 'Zona' },
  { key: 'type', label: 'Tipo' },
  { key: 'capacity', label: 'Ocupación', align: 'center' as const },
  { key: 'occupancy', label: 'Uso', align: 'left' as const },
  { key: 'actions', label: '', align: 'right' as const },
]

const asShelter = (r: unknown) => r as ShelterWithOccupancy
// % de ocupación (verde <70 · ámbar 70-90 · rojo >90, HU-10 CA2).
const occPct = (s: ShelterWithOccupancy) =>
  s.max_capacity > 0 ? (s.current_occupancy / s.max_capacity) * 100 : 0

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  search.value = ''
  zoneFilter.value = ''
  typeFilter.value = ''
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, setOccupancy, remove } = useShelterMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)

const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    name: '',
    address: '',
    zone_id: '',
    type: '',
    max_capacity: '',
    current_occupancy: '',
    latitude: null as number | null,
    longitude: null as number | null,
  }
}
const form = ref(blankForm())

function openCreate() {
  editId.value = null
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function openEdit(s: ShelterWithOccupancy) {
  editId.value = s.id
  form.value = {
    name: s.name,
    address: s.address,
    zone_id: String(s.zone_id),
    type: s.type,
    max_capacity: String(s.max_capacity),
    current_occupancy: String(s.current_occupancy),
    latitude: s.latitude,
    longitude: s.longitude,
  }
  errors.value = {}
  modalOpen.value = true
}

async function submit() {
  const res = validate(shelterSchema, {
    name: form.value.name,
    address: form.value.address,
    zone_id: form.value.zone_id,
    type: form.value.type,
    max_capacity: form.value.max_capacity,
    current_occupancy: form.value.current_occupancy,
  })
  const errs: Record<string, string> = res.ok ? {} : { ...res.errors }
  if (form.value.latitude == null || form.value.longitude == null) {
    errs.location = 'Ubica el refugio en el mapa (obligatorio).'
  }
  errors.value = errs
  if (!res.ok || errs.location) return

  const payload: ShelterPayload = {
    name: res.data.name,
    address: res.data.address,
    zone_id: res.data.zone_id,
    type: res.data.type,
    max_capacity: res.data.max_capacity,
    current_occupancy: res.data.current_occupancy,
    latitude: form.value.latitude!,
    longitude: form.value.longitude!,
  }
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Refugio actualizado' : 'Refugio creado')
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Modal de ocupación -------------------------------------------------------
const occOpen = ref(false)
const occTarget = ref<ShelterWithOccupancy | null>(null)
const occValue = ref('')
const occError = ref('')
const occSaving = computed(() => setOccupancy.isPending.value)

function openOccupancy(s: ShelterWithOccupancy) {
  occTarget.value = s
  occValue.value = String(s.current_occupancy)
  occError.value = ''
  occOpen.value = true
}
async function saveOccupancy() {
  if (!occTarget.value) return
  const n = Number(occValue.value)
  if (occValue.value === '' || Number.isNaN(n) || !Number.isInteger(n)) {
    occError.value = 'Ingresa un número entero válido.'
    return
  }
  if (n < 0) {
    occError.value = 'No puede ser negativo.'
    return
  }
  if (n > occTarget.value.max_capacity) {
    occError.value = `No puede superar la capacidad máxima (${occTarget.value.max_capacity}).`
    return
  }
  try {
    await setOccupancy.mutateAsync({ id: occTarget.value.id, value: n })
    toast.success('Ocupación actualizada')
    occOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Eliminar -----------------------------------------------------------------
const confirmOpen = ref(false)
const target = ref<ShelterWithOccupancy | null>(null)
function askDelete(s: ShelterWithOccupancy) {
  target.value = s
  confirmOpen.value = true
}
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Refugio eliminado')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo eliminar: el refugio puede tener familias asociadas.'))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Refugios"
      crumb="Censo"
      :subtitle="total ? `${total} ${total === 1 ? 'refugio registrado' : 'refugios registrados'}` : 'Capacidad y ocupación de refugios temporales'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Agregar refugio</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SearchInput v-model="search" placeholder="Buscar por nombre o dirección…" />
      <SelectField v-model="zoneFilter" :options="zoneFilterOptions" />
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los refugios.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="880px">
          <template #name="{ row }">
            <div>
              <p class="font-semibold text-neutral-900">{{ asShelter(row).name }}</p>
              <p class="text-xs text-neutral-500">{{ asShelter(row).address }}</p>
            </div>
          </template>

          <template #zone="{ row }">
            {{ zoneMap.get(asShelter(row).zone_id)?.name ?? '—' }}
          </template>

          <template #type="{ row }">{{ SHELTER_TYPE_LABELS[asShelter(row).type] }}</template>

          <template #capacity="{ row }">
            <span class="font-mono text-xs">
              {{ asShelter(row).current_occupancy }} / {{ asShelter(row).max_capacity }}
            </span>
          </template>

          <template #occupancy="{ row }">
            <div class="min-w-[120px]">
              <ProgressBar :value="occPct(asShelter(row))" :ok="31" :warn="10" invert />
            </div>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...OCCUPANCY_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openOccupancy(asShelter(row))">
                  <Users /> Ocupación
                </AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openEdit(asShelter(row))"><Pencil /></AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" class="text-danger" @click="askDelete(asShelter(row))">
                  <Trash2 />
                </AppButton>
              </RoleGate>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin refugios"
              :message="hasFilters ? 'No hay refugios que coincidan con los filtros.' : 'Aún no se han registrado refugios.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Agregar refugio</AppButton>
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
      :title="editId != null ? 'Editar refugio' : 'Nuevo refugio'"
      max-width="max-w-[620px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="sh-name">
          <input id="sh-name" v-model="form.name" class="control" placeholder="Ej. I.E. San José" />
        </FormField>

        <FormField label="Dirección" required :error="errors.address" input-id="sh-address">
          <input id="sh-address" v-model="form.address" class="control" placeholder="Calle 1 # 2-34" />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.zone_id"
            label="Zona"
            required
            :options="zoneFormOptions"
            :error="errors.zone_id"
            input-id="sh-zone"
          />
          <SelectField
            v-model="form.type"
            label="Tipo"
            required
            :options="typeFormOptions"
            :error="errors.type"
            input-id="sh-type"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Capacidad máxima" required :error="errors.max_capacity" input-id="sh-cap">
            <input id="sh-cap" v-model="form.max_capacity" type="number" min="1" class="control" placeholder="0" />
          </FormField>
          <FormField label="Ocupación actual" :error="errors.current_occupancy" input-id="sh-occ" hint="Opcional (por defecto 0)">
            <input id="sh-occ" v-model="form.current_occupancy" type="number" min="0" class="control" placeholder="0" />
          </FormField>
        </div>

        <FormField
          label="Ubicación"
          required
          :error="errors.location"
          hint="Obligatoria (RN-10). Toca el mapa para colocar el marcador; arrástralo para ajustar."
        >
          <MapPicker v-model:latitude="form.latitude" v-model:longitude="form.longitude" height="260px" />
        </FormField>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear refugio' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Modal de ocupación -->
    <BaseModal
      :open="occOpen"
      title="Actualizar ocupación"
      max-width="max-w-[420px]"
      @close="occOpen = false"
    >
      <div v-if="occTarget" class="space-y-4">
        <p class="text-sm text-neutral-600">
          <strong class="text-neutral-900">{{ occTarget.name }}</strong> · capacidad máxima
          {{ occTarget.max_capacity }} personas.
        </p>
        <FormField label="Ocupación actual" required :error="occError" input-id="occ-input">
          <input
            id="occ-input"
            v-model="occValue"
            type="number"
            min="0"
            :max="occTarget.max_capacity"
            class="control"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="occOpen = false">Cancelar</AppButton>
        <AppButton :disabled="occSaving" @click="saveOccupancy">
          {{ occSaving ? 'Guardando…' : 'Actualizar' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación -->
    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar refugio"
      :message="target ? `¿Eliminar el refugio “${target.name}”? Esta acción no se puede deshacer.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
