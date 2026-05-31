<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Trash2, SearchX, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle,
} from '@lucide/vue'
import { useWarehouses, useWarehouseMutations } from '@/composables/useWarehouses'
import { useZones } from '@/composables/useZones'
import {
  WAREHOUSE_STATUS_OPTIONS, WAREHOUSE_STATUS_LABELS,
} from '@/types/warehouse.types'
import type {
  Warehouse, WarehouseListParams, WarehousePayload, WarehouseStatus,
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

const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const router = useRouter()

// --- Filtros + listado --------------------------------------------------------
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

const { data, isLoading, isFetching, isError, refetch } = useWarehouses(params)
const { data: zones } = useZones()

const zoneMap = computed(() => new Map((zones.value ?? []).map((z) => [z.id, z])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(search.value || zoneFilter.value || statusFilter.value))

// HU-11 CA3: bodegas en la página actual con uso >= 85% (alerta visual destacada).
// Usa la bandera real del backend is_over_85_percent (fn_warehouses_list).
const overCapacity = computed(() => rows.value.filter((w) => w.is_over_85_percent))

const zoneFilterOptions = computed(() => [
  { value: '', label: 'Todas las zonas' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const zoneFormOptions = computed(() => [
  { value: '', label: 'Selecciona la zona…' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const statusFilterOptions = [{ value: '', label: 'Todos los estados' }, ...WAREHOUSE_STATUS_OPTIONS]
const statusFormOptions = WAREHOUSE_STATUS_OPTIONS

const columns = [
  { key: 'name', label: 'Bodega' },
  { key: 'zone', label: 'Zona' },
  { key: 'status', label: 'Estado' },
  { key: 'capacity', label: 'Peso (kg)', align: 'center' as const },
  { key: 'usage', label: 'Uso', align: 'left' as const },
  { key: 'actions', label: '', align: 'right' as const },
]

const asWarehouse = (r: unknown) => r as Warehouse
const formatKg = (n: number) => Math.round(n).toLocaleString('es-CO')
// % de uso de capacidad (el backend solo expone occupancy_ratio/is_over_85_percent).
const usagePct = (w: Warehouse) =>
  w.max_capacity_kg > 0 ? (w.current_weight_kg / w.max_capacity_kg) * 100 : 0

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
function openEdit(w: Warehouse) {
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
  // RN-10: la ubicación (lat/lng) es obligatoria para guardar.
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
const target = ref<Warehouse | null>(null)
function askDelete(w: Warehouse) {
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
      :subtitle="total ? `${total} ${total === 1 ? 'bodega registrada' : 'bodegas registradas'}` : 'Capacidad y ocupación de bodegas'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Nueva bodega</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- HU-11 CA3: alerta destacada de bodegas al/por encima del 85% -->
    <div
      v-if="overCapacity.length"
      class="flex items-start gap-3 rounded-lg border border-warning-br bg-warning-bg p-4"
    >
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div class="text-sm">
        <p class="font-semibold text-warning">
          {{ overCapacity.length }}
          {{ overCapacity.length === 1 ? 'bodega alcanzó' : 'bodegas alcanzaron' }} el 85% de su capacidad
        </p>
        <p class="mt-0.5 text-neutral-600">
          {{ overCapacity.map((w) => w.name).join(', ') }}
        </p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SearchInput v-model="search" placeholder="Buscar por nombre o dirección…" />
      <SelectField v-model="zoneFilter" :options="zoneFilterOptions" />
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las bodegas.</p>
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
          <template #name="{ row }">
            <button
              type="button"
              class="text-left"
              @click="router.push(`/warehouses/${asWarehouse(row).id}`)"
            >
              <p class="font-semibold text-primary-700 hover:underline">{{ asWarehouse(row).name }}</p>
              <p class="text-xs text-neutral-500">{{ asWarehouse(row).address }}</p>
            </button>
          </template>

          <template #zone="{ row }">
            {{ zoneMap.get(asWarehouse(row).zone_id)?.name ?? '—' }}
          </template>

          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                asWarehouse(row).status === 'ACTIVE'
                  ? 'text-success bg-success-bg border-success-br'
                  : 'text-neutral-500 bg-neutral-100 border-neutral-200',
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ WAREHOUSE_STATUS_LABELS[asWarehouse(row).status] }}
            </span>
          </template>

          <template #capacity="{ row }">
            <span class="font-mono text-xs">
              {{ formatKg(asWarehouse(row).current_weight_kg) }} / {{ formatKg(asWarehouse(row).max_capacity_kg) }}
            </span>
          </template>

          <template #usage="{ row }">
            <div class="flex min-w-[140px] items-center gap-2">
              <div class="flex-1">
                <!-- Capacidad: verde <85 · ámbar 85-99 · rojo 100% (umbrales 85/100). -->
                <ProgressBar :value="usagePct(asWarehouse(row))" :ok="16" :warn="1" invert />
              </div>
              <span
                class="w-12 shrink-0 text-right font-mono text-xs"
                :class="asWarehouse(row).is_over_85_percent ? 'font-semibold text-danger' : 'text-neutral-500'"
              >
                {{ Math.round(usagePct(asWarehouse(row))) }}%
              </span>
            </div>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openEdit(asWarehouse(row))"><Pencil /></AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" class="text-danger" @click="askDelete(asWarehouse(row))">
                  <Trash2 />
                </AppButton>
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
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Nueva bodega</AppButton>
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
          <SelectField
            v-model="form.zone_id"
            label="Zona"
            required
            :options="zoneFormOptions"
            :error="errors.zone_id"
            input-id="wh-zone"
          />
          <SelectField
            v-model="form.status"
            label="Estado"
            required
            :options="statusFormOptions"
            :error="errors.status"
            input-id="wh-status"
          />
        </div>

        <FormField
          label="Capacidad máxima (kg)"
          required
          :error="errors.max_capacity_kg"
          input-id="wh-cap"
          hint="El peso actual se calcula a partir del inventario."
        >
          <input id="wh-cap" v-model="form.max_capacity_kg" type="number" min="0" step="0.01" class="control" placeholder="0" />
        </FormField>

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
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear bodega' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación -->
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
