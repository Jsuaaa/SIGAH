<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ArrowLeft, PackagePlus, SlidersHorizontal, RotateCcw, PackageOpen, TriangleAlert,
} from '@lucide/vue'
import { useWarehouse, useWarehouseInventory } from '@/composables/useWarehouses'
import { useInventoryMutations } from '@/composables/useInventory'
import { useResourceTypes } from '@/composables/useResourceTypes'
import { useZones } from '@/composables/useZones'
import { RESOURCE_CATEGORY_LABELS, ADJUSTMENT_REASON_OPTIONS } from '@/types/inventory.types'
import type { AdjustInventoryPayload, InventoryRow, UpsertInventoryPayload } from '@/types/inventory.types'
import type { ResourceTypeListParams } from '@/types/inventory.types'
import { upsertInventorySchema, adjustmentSchema } from '@/schemas/inventory.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const warehouseId = computed(() => Number(route.params.id))
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const { data: warehouse, isLoading, isError, refetch } = useWarehouse(warehouseId)
const { data: inventory, isLoading: loadingInv } = useWarehouseInventory(warehouseId)
const { data: zones } = useZones()
const activeResourceParams = ref<ResourceTypeListParams>({ is_active: true })
const { data: resourceTypes } = useResourceTypes(activeResourceParams)
const { upsert, adjust } = useInventoryMutations()

const zoneName = computed(() => (zones.value ?? []).find((z) => z.id === warehouse.value?.zone_id)?.name ?? '—')
const usagePct = computed(() =>
  warehouse.value && warehouse.value.max_capacity_kg > 0
    ? (warehouse.value.current_weight_kg / warehouse.value.max_capacity_kg) * 100
    : 0,
)
const kg = (n: number) => `${Math.round(n).toLocaleString('es-CO')} kg`
const asRow = (r: unknown) => r as InventoryRow

const resourceOptions = computed(() => [
  { value: '', label: 'Selecciona el recurso…' },
  ...(resourceTypes.value ?? []).map((rt) => ({ value: String(rt.id), label: `${rt.name} (${rt.unit_of_measure})` })),
])

const columns = [
  { key: 'resource', label: 'Recurso' },
  { key: 'quantity', label: 'Disponible', align: 'right' as const },
  { key: 'weight', label: 'Peso', align: 'right' as const },
  { key: 'batch', label: 'Lote' },
  { key: 'expiration', label: 'Vence' },
  { key: 'actions', label: '', align: 'right' as const },
]

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function daysUntil(s: string) {
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)
}
// Resaltado de vencimientos: rojo vencido, ámbar ≤30 días (HU-17).
function expiryClass(row: InventoryRow) {
  if (!row.expiration_date) return 'text-neutral-400'
  if (row.is_expired) return 'text-danger font-semibold'
  return daysUntil(row.expiration_date) <= 30 ? 'text-warning font-medium' : 'text-neutral-700'
}

// --- Agregar stock ------------------------------------------------------------
const addOpen = ref(false)
const addErrors = ref<Record<string, string>>({})
const adding = computed(() => upsert.isPending.value)
function blankAdd() {
  return { resource_type_id: '', quantity: '', batch: '', expiration_date: '' }
}
const addForm = ref(blankAdd())
function openAdd() {
  addForm.value = blankAdd()
  addErrors.value = {}
  addOpen.value = true
}
async function submitAdd() {
  const res = validate(upsertInventorySchema, { ...addForm.value })
  if (!res.ok) {
    addErrors.value = res.errors
    return
  }
  addErrors.value = {}
  const payload: UpsertInventoryPayload = {
    warehouse_id: warehouseId.value,
    resource_type_id: res.data.resource_type_id,
    quantity: res.data.quantity,
    batch: res.data.batch?.trim() ? res.data.batch : null,
    expiration_date: res.data.expiration_date || null,
  }
  try {
    await upsert.mutateAsync(payload)
    toast.success('Stock agregado')
    addOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo agregar stock. ¿Supera la capacidad de la bodega?'))
  }
}

// --- Ajustar ------------------------------------------------------------------
const adjOpen = ref(false)
const adjTarget = ref<InventoryRow | null>(null)
const adjErrors = ref<Record<string, string>>({})
const adjusting = computed(() => adjust.isPending.value)
function blankAdj() {
  return { delta: '', reason: '', reason_note: '' }
}
const adjForm = ref(blankAdj())
const reasonOptions = [{ value: '', label: 'Selecciona el motivo…' }, ...ADJUSTMENT_REASON_OPTIONS]

function openAdjust(row: InventoryRow) {
  adjTarget.value = row
  adjForm.value = blankAdj()
  adjErrors.value = {}
  adjOpen.value = true
}
async function submitAdjust() {
  if (!adjTarget.value) return
  const res = validate(adjustmentSchema, { ...adjForm.value })
  if (!res.ok) {
    adjErrors.value = res.errors
    return
  }
  adjErrors.value = {}
  const payload: AdjustInventoryPayload = {
    delta: res.data.delta,
    reason: res.data.reason,
    reason_note: res.data.reason_note,
  }
  try {
    await adjust.mutateAsync({ id: adjTarget.value.id, payload })
    toast.success('Ajuste aplicado')
    adjOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo ajustar: el resultado no puede dejar stock negativo (HU-17).'))
  }
}
</script>

<template>
  <section class="space-y-5">
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="120px" />
      <SkeletonBlock height="200px" />
    </div>
    <div v-else-if="isError || !warehouse" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la bodega.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <template v-else>
      <PageHeader :title="warehouse.name" :crumb="`Bodegas · ${warehouse.address}`">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/warehouses')"><ArrowLeft /> Volver</AppButton>
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton @click="openAdd"><PackagePlus /> Agregar stock</AppButton>
          </RoleGate>
        </template>
      </PageHeader>

      <!-- Resumen de capacidad -->
      <div class="rounded-lg border border-neutral-200 bg-white p-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p class="text-sm text-neutral-500">Zona</p>
            <p class="font-medium text-neutral-900">{{ zoneName }}</p>
          </div>
          <div>
            <p class="text-sm text-neutral-500">Peso almacenado</p>
            <p class="font-medium text-neutral-900">{{ kg(warehouse.current_weight_kg) }} / {{ kg(warehouse.max_capacity_kg) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <ProgressBar :value="usagePct" :ok="16" :warn="1" invert label="Uso de capacidad" />
            </div>
            <span v-if="warehouse.is_over_85_percent" class="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-warning">
              <TriangleAlert class="h-3.5 w-3.5" /> 85%
            </span>
          </div>
        </div>
      </div>

      <!-- Inventario -->
      <div v-if="loadingInv" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
        <SkeletonBlock v-for="n in 4" :key="n" height="40px" />
      </div>
      <DataTable v-else :columns="columns" :rows="inventory ?? []" row-key="id" min-width="820px">
        <template #resource="{ row }">
          <div>
            <p class="font-medium text-neutral-900">{{ asRow(row).resource.name }}</p>
            <p class="text-xs text-neutral-500">{{ RESOURCE_CATEGORY_LABELS[asRow(row).resource.category] }}</p>
          </div>
        </template>
        <template #quantity="{ row }">
          <span class="font-mono">{{ asRow(row).available_quantity }}</span>
          <span class="text-xs text-neutral-500"> {{ asRow(row).resource.unit_of_measure }}</span>
        </template>
        <template #weight="{ row }"><span class="font-mono text-xs">{{ kg(asRow(row).total_weight_kg) }}</span></template>
        <template #batch="{ row }"><span class="text-sm text-neutral-600">{{ asRow(row).batch || '—' }}</span></template>
        <template #expiration="{ row }">
          <span :class="['text-sm', expiryClass(asRow(row))]">
            {{ fmtDate(asRow(row).expiration_date) }}
            <span v-if="asRow(row).is_expired"> · vencido</span>
          </span>
        </template>
        <template #actions="{ row }">
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton variant="ghost" size="sm" @click="openAdjust(asRow(row))"><SlidersHorizontal /> Ajustar</AppButton>
          </RoleGate>
        </template>
        <template #empty>
          <EmptyState title="Sin existencias" message="Esta bodega no tiene inventario registrado.">
            <template #icon><PackageOpen /></template>
            <template #action>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton size="sm" @click="openAdd"><PackagePlus /> Agregar stock</AppButton>
              </RoleGate>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </template>

    <!-- Modal agregar stock -->
    <BaseModal :open="addOpen" title="Agregar stock" max-width="max-w-[520px]" @close="addOpen = false">
      <form class="space-y-4" @submit.prevent="submitAdd">
        <SelectField v-model="addForm.resource_type_id" label="Recurso" required :options="resourceOptions" :error="addErrors.resource_type_id" input-id="add-rt" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Cantidad" required :error="addErrors.quantity" input-id="add-qty">
            <input id="add-qty" v-model="addForm.quantity" type="number" min="1" class="control" placeholder="0" />
          </FormField>
          <FormField label="Lote" :error="addErrors.batch" input-id="add-batch" hint="Opcional">
            <input id="add-batch" v-model="addForm.batch" class="control" placeholder="Ej. L-2026-01" />
          </FormField>
        </div>
        <FormField label="Fecha de vencimiento" :error="addErrors.expiration_date" input-id="add-exp" hint="Opcional (solo perecederos)">
          <input id="add-exp" v-model="addForm.expiration_date" type="date" class="control" />
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="addOpen = false">Cancelar</AppButton>
        <AppButton :disabled="adding" @click="submitAdd">{{ adding ? 'Guardando…' : 'Agregar' }}</AppButton>
      </template>
    </BaseModal>

    <!-- Modal ajustar -->
    <BaseModal :open="adjOpen" title="Ajustar existencias" max-width="max-w-[520px]" @close="adjOpen = false">
      <form v-if="adjTarget" class="space-y-4" @submit.prevent="submitAdjust">
        <p class="text-sm text-neutral-600">
          <strong class="text-neutral-900">{{ adjTarget.resource.name }}</strong> ·
          disponible: {{ adjTarget.available_quantity }} {{ adjTarget.resource.unit_of_measure }}.
        </p>
        <FormField
          label="Ajuste (delta)"
          required
          :error="adjErrors.delta"
          input-id="adj-delta"
          hint="Positivo suma, negativo resta. El resultado no puede ser negativo."
        >
          <input id="adj-delta" v-model="adjForm.delta" type="number" step="1" class="control" placeholder="Ej. -5" />
        </FormField>
        <SelectField v-model="adjForm.reason" label="Motivo" required :options="reasonOptions" :error="adjErrors.reason" input-id="adj-reason" />
        <FormField label="Nota / justificación" required :error="adjErrors.reason_note" input-id="adj-note" hint="Obligatoria (HU-17 CA2).">
          <textarea id="adj-note" v-model="adjForm.reason_note" class="control" rows="3" placeholder="Describe el motivo del ajuste…" />
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="adjOpen = false">Cancelar</AppButton>
        <AppButton :disabled="adjusting" @click="submitAdjust">{{ adjusting ? 'Aplicando…' : 'Aplicar ajuste' }}</AppButton>
      </template>
    </BaseModal>
  </section>
</template>
