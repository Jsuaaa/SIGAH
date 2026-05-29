<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Trash2, Eye, SearchX, RotateCcw, ChevronLeft, ChevronRight, TriangleAlert,
} from '@lucide/vue'
import { useWarehousesList, useWarehouseMutations } from '@/composables/useWarehouses'
import { useZones } from '@/composables/useZones'
import { WAREHOUSE_STATUS_OPTIONS, WAREHOUSE_STATUS_LABELS } from '@/types/warehouse.types'
import type {
  WarehouseListParams, WarehousePayload, WarehouseStatus, WarehouseWithOccupancy,
} from '@/types/warehouse.types'
import { warehouseSchema } from '@/schemas/warehouse.schema'
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

const router = useRouter()
const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const search = ref('')
const zoneFilter = ref('')
const statusFilter = ref('')
const page = ref(1)

const params = computed<WarehouseListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(search.value ? { search: search.value } : {}),
  ...(zoneFilter.value ? { zone_id: Number(zoneFilter.value) } : {}),
  ...(statusFilter.value ? { status: statusFilter.value as WarehouseStatus } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useWarehousesList(params)
const { data: zones } = useZones()

const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(search.value || zoneFilter.value || statusFilter.value))

const zoneFilterOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const zoneFormOptions = computed(() => [
  { value: '', label: 'Selecciona la zona…' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const statusFilterOptions = [{ value: '', label: 'Todos los estados' }, ...WAREHOUSE_STATUS_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))]
const statusFormOptions = WAREHOUSE_STATUS_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))

const columns = [
  { key: 'name', label: 'Bodega' },
  { key: 'zone', label: 'Zona' },
  { key: 'capacity', label: 'Peso / capacidad', align: 'right' as const },
  { key: 'usage', label: 'Uso' },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]

const asWarehouse = (r: unknown) => r as WarehouseWithOccupancy
const usagePct = (w: WarehouseWithOccupancy) =>
  w.max_capacity_kg > 0 ? (w.current_weight_kg / w.max_capacity_kg) * 100 : 0
const kg = (n: number) => `${Math.round(n).toLocaleString('es-CO')} kg`

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  search.value = ''
  zoneFilter.value = ''
  statusFilter.value = ''
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, remove } = useWarehouseMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    name: '',
    address: '',
    zone_id: '',
    max_capacity_kg: '',
    status: 'ACTIVE' as WarehouseStatus,
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
function openEdit(w: WarehouseWithOccupancy) {
  editId.value = w.id
  form.value = {
    name: w.name,
    address: w.address,
    zone_id: String(w.zone_id),
    max_capacity_kg: String(w.max_capacity_kg),
    status: w.status,
    latitude: w.latitude,
    longitude: w.longitude,
  }
  errors.value = {}
  modalOpen.value = true
}

async function submit() {
  const res = validate(warehouseSchema, {
    name: form.value.name,
    address: form.value.address,
    zone_id: form.value.zone_id,
    max_capacity_kg: form.value.max_capacity_kg,
    status: form.value.status,
  })
  const errs: Record<string, string> = res.ok ? {} : { ...res.errors }
  if (form.value.latitude == null || form.value.longitude == null) {
    errs.location = 'Ubica la bodega en el mapa (obligatorio).'
  }
  errors.value = errs
  if (!res.ok || errs.location) return

  const payload: WarehousePayload = {
    name: res.data.name,
    address: res.data.address,
    zone_id: res.data.zone_id,
    max_capacity_kg: res.data.max_capacity_kg,
    status: res.data.status,
    latitude: form.value.latitude!,
    longitude: form.value.longitude!,
  }
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Bodega actualizada' : 'Bodega creada')
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Eliminar -----------------------------------------------------------------
const confirmOpen = ref(false)
const target = ref<WarehouseWithOccupancy | null>(null)
function askDelete(w: WarehouseWithOccupancy) {
  target.value = w
  confirmOpen.value = true
}
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Bodega eliminada')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo eliminar: la bodega puede tener inventario asociado.'))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Bodegas"
      crumb="Logística"
      :subtitle="total ? `${total} ${total === 1 ? 'bodega' : 'bodegas'}` : 'Capacidad y almacenamiento de ayudas'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Agregar bodega</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SearchInput v-model="search" placeholder="Buscar por nombre o dirección…" />
      <SelectField v-model="zoneFilter" :options="zoneFilterOptions" />
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las bodegas.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="900px">
          <template #name="{ row }">
            <div>
              <p class="font-semibold text-neutral-900">{{ asWarehouse(row).name }}</p>
              <p class="text-xs text-neutral-500">{{ asWarehouse(row).address }}</p>
            </div>
          </template>

          <template #zone="{ row }">{{ zoneMap.get(asWarehouse(row).zone_id)?.name ?? '—' }}</template>

          <template #capacity="{ row }">
            <span class="font-mono text-xs">{{ kg(asWarehouse(row).current_weight_kg) }} / {{ kg(asWarehouse(row).max_capacity_kg) }}</span>
          </template>

          <template #usage="{ row }">
            <div class="flex min-w-[150px] items-center gap-2">
              <div class="flex-1"><ProgressBar :value="usagePct(asWarehouse(row))" :ok="16" :warn="1" invert /></div>
              <span
                v-if="asWarehouse(row).is_over_85_percent"
                class="inline-flex items-center gap-1 text-xs font-semibold text-warning"
                title="Capacidad sobre el 85% (HU-11)"
              >
                <TriangleAlert class="h-3.5 w-3.5" /> 85%
              </span>
            </div>
          </template>

          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                asWarehouse(row).status === 'ACTIVE'
                  ? 'border-success-br bg-success-bg text-success'
                  : 'border-neutral-200 bg-neutral-100 text-neutral-500',
              ]"
            >
              {{ WAREHOUSE_STATUS_LABELS[asWarehouse(row).status] }}
            </span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <AppButton variant="ghost" size="sm" @click="router.push(`/warehouses/${asWarehouse(row).id}`)">
                <Eye /> Ver
              </AppButton>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openEdit(asWarehouse(row))"><Pencil /></AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" class="text-danger" @click="askDelete(asWarehouse(row))"><Trash2 /></AppButton>
              </RoleGate>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin bodegas"
              :message="hasFilters ? 'No hay bodegas que coincidan con los filtros.' : 'Aún no se han registrado bodegas.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Agregar bodega</AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong></span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>

    <!-- Modal crear / editar -->
    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar bodega' : 'Nueva bodega'"
      max-width="max-w-[620px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="wh-name">
          <input id="wh-name" v-model="form.name" class="control" placeholder="Ej. Bodega Central" />
        </FormField>
        <FormField label="Dirección" required :error="errors.address" input-id="wh-address">
          <input id="wh-address" v-model="form.address" class="control" placeholder="Calle 1 # 2-34" />
        </FormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField v-model="form.zone_id" label="Zona" required :options="zoneFormOptions" :error="errors.zone_id" input-id="wh-zone" />
          <SelectField v-model="form.status" label="Estado" required :options="statusFormOptions" :error="errors.status" input-id="wh-status" />
        </div>
        <FormField label="Capacidad máxima (kg)" required :error="errors.max_capacity_kg" input-id="wh-cap">
          <input id="wh-cap" v-model="form.max_capacity_kg" type="number" min="1" step="any" class="control" placeholder="0" />
        </FormField>
        <FormField
          label="Ubicación"
          required
          :error="errors.location"
          hint="Obligatoria (HU-11 CA2). Toca el mapa para colocar el marcador."
        >
          <MapPicker v-model:latitude="form.latitude" v-model:longitude="form.longitude" height="260px" />
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear bodega' }}
        </AppButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar bodega"
      :message="target ? `¿Eliminar la bodega “${target.name}”? Esta acción no se puede deshacer.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
