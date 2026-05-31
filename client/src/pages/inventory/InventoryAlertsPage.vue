<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  Bell, BellRing, AlertTriangle, ShieldCheck, ExternalLink, Check, X, Pencil,
  SearchX, RotateCcw, Sliders,
} from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useStockAlerts, useAlertThresholds, useAlertMutations } from '@/composables/useAlerts'
import { useAllResourceTypes } from '@/composables/useResourceTypes'
import {
  RESOURCE_CATEGORY_OPTIONS, RESOURCE_CATEGORY_LABELS, RESOURCE_CATEGORY_BADGE,
} from '@/types/resourceType.types'
import type { ResourceCategory, ResourceType } from '@/types/resourceType.types'
import {
  SEVERITY_LABELS, SEVERITY_BADGE, SEVERITY_ORDER, ALERT_KIND_LABELS,
} from '@/types/alert.types'
import type { StockAlert } from '@/types/alert.types'
import { alertThresholdSchema } from '@/schemas/alert.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import KpiCard from '@/components/ui/KpiCard.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

// HU-16: editar umbrales solo para logística; cualquier rol autenticado ve las
// alertas (lectura). El backend autoriza el PUT a ADMIN/COORDINADOR_LOGISTICA.
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const
const GLOBAL_DEFAULT_THRESHOLD = 10 // fallback de fn_inventory_alerts sin umbral explícito.

const router = useRouter()

// --- Sección 1: alertas activas (CA1/CA3) ------------------------------------
const {
  data: alerts, isLoading: alertsLoading, isError: alertsError, refetch: refetchAlerts,
} = useStockAlerts()

const asAlert = (r: unknown) => r as StockAlert
const allAlerts = computed<StockAlert[]>(() => alerts.value ?? [])

// HU-16 se centra en stock bajo; lo destacamos arriba y dejamos el resto
// (vencimientos / capacidad) en una sección secundaria.
const lowStockAlerts = computed(() =>
  allAlerts.value
    .filter((a) => a.kind === 'LOW_STOCK')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
)
const otherAlerts = computed(() =>
  allAlerts.value
    .filter((a) => a.kind !== 'LOW_STOCK')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
)

// KPI: conteo de alertas activas (todas) y de las críticas.
const totalAlerts = computed(() => allAlerts.value.length)
const criticalCount = computed(
  () => allAlerts.value.filter((a) => a.severity === 'CRITICAL').length,
)
const lowStockCount = computed(() => lowStockAlerts.value.length)

const alertColumns = [
  { key: 'severity', label: 'Severidad' },
  { key: 'resource', label: 'Recurso' },
  { key: 'detail', label: 'Detalle' },
  { key: 'stock', label: 'Existencias / umbral', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]

const otherColumns = [
  { key: 'severity', label: 'Severidad' },
  { key: 'kind', label: 'Tipo' },
  { key: 'detail', label: 'Detalle' },
  { key: 'actions', label: '', align: 'right' as const },
]

function goToLink(link: string) {
  // Los enlaces del backend son rutas relativas de la app (p.ej. /warehouses/3).
  if (link) router.push(link)
}

// --- Sección 2: configuración de umbrales (CA2) ------------------------------
const { data: thresholds, isLoading: thrLoading, isError: thrError, refetch: refetchThresholds } =
  useAlertThresholds()
const { data: resourceTypes, isLoading: rtLoading } = useAllResourceTypes()
const { upsert } = useAlertMutations()

const categoryFilter = ref('')
const categoryFilterOptions = computed(() => [
  { value: '', label: 'Todas las categorías' },
  ...RESOURCE_CATEGORY_OPTIONS,
])

// Mapa resource_type_id → umbral configurado (para fusionar con el catálogo).
const thresholdMap = computed(
  () => new Map((thresholds.value ?? []).map((t) => [t.resource_type_id, t])),
)

// Fila editable: un renglón por cada recurso activo del catálogo. Si tiene
// umbral configurado, muestra su valor; si no, indica que usa el global (10).
interface ThresholdRow {
  resource_type_id: number
  name: string
  category: ResourceCategory
  unit_of_measure: string
  min_quantity: number | null // null → sin umbral explícito (usa el global)
  is_active: boolean
}

const thresholdRows = computed<ThresholdRow[]>(() => {
  const list = (resourceTypes.value ?? []) as ResourceType[]
  return list
    .filter((rt) =>
      categoryFilter.value ? rt.category === (categoryFilter.value as ResourceCategory) : true,
    )
    .map((rt) => {
      const t = thresholdMap.value.get(rt.id)
      return {
        resource_type_id: rt.id,
        name: rt.name,
        category: rt.category,
        unit_of_measure: rt.unit_of_measure,
        min_quantity: t ? t.min_quantity : null,
        is_active: rt.is_active,
      }
    })
})

const thresholdsBusy = computed(() => thrLoading.value || rtLoading.value)
const hasThresholdFilter = computed(() => !!categoryFilter.value)

const thresholdColumns = [
  { key: 'resource', label: 'Recurso' },
  { key: 'category', label: 'Categoría' },
  { key: 'threshold', label: 'Umbral mínimo', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]

const asThresholdRow = (r: unknown) => r as ThresholdRow

// Edición inline: una fila a la vez.
const editingId = ref<number | null>(null)
const editValue = ref('')
const editError = ref('')
const savingId = ref<number | null>(null)
const saving = computed(() => upsert.isPending.value)

function startEdit(row: ThresholdRow) {
  editingId.value = row.resource_type_id
  // Precarga con el umbral actual o con el global por defecto como sugerencia.
  editValue.value = String(row.min_quantity ?? GLOBAL_DEFAULT_THRESHOLD)
  editError.value = ''
}
function cancelEdit() {
  editingId.value = null
  editValue.value = ''
  editError.value = ''
}

async function saveEdit(row: ThresholdRow) {
  const res = validate(alertThresholdSchema, { min_quantity: editValue.value })
  if (!res.ok) {
    editError.value = res.errors.min_quantity ?? 'Valor inválido'
    return
  }
  savingId.value = row.resource_type_id
  try {
    await upsert.mutateAsync({
      resource_type_id: row.resource_type_id,
      min_quantity: res.data.min_quantity,
    })
    toast.success(`Umbral de “${row.name}” actualizado`)
    cancelEdit()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo guardar el umbral.'))
  } finally {
    savingId.value = null
  }
}

// Estado del último input por fila para que cada renglón tenga su id de control.
const inputIds = reactive<Record<number, string>>({})
function inputIdFor(id: number) {
  if (!inputIds[id]) inputIds[id] = `thr-${id}`
  return inputIds[id]
}
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Alertas de stock"
      crumb="Logística"
      subtitle="Recursos por debajo del umbral y configuración de mínimos por recurso"
    />

    <!-- KPIs ------------------------------------------------------------------ -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Alertas activas"
        :value="totalAlerts"
        :tone="totalAlerts ? 'warning' : 'primary'"
      >
        <template #icon><BellRing /></template>
      </KpiCard>
      <KpiCard label="Stock bajo" :value="lowStockCount" :tone="lowStockCount ? 'warning' : 'primary'">
        <template #icon><AlertTriangle /></template>
      </KpiCard>
      <KpiCard label="Críticas" :value="criticalCount" :tone="criticalCount ? 'danger' : 'primary'">
        <template #icon><Bell /></template>
      </KpiCard>
    </div>

    <!-- Sección 1: alertas de stock bajo (CA1/CA3) ---------------------------- -->
    <div class="space-y-3">
      <h2 class="flex items-center gap-2 text-lg font-semibold text-neutral-900">
        <AlertTriangle class="h-5 w-5 text-warning" /> Alertas de stock bajo
      </h2>

      <!-- Error -->
      <div v-if="alertsError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
        <p class="text-sm text-danger">No se pudieron cargar las alertas.</p>
        <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetchAlerts()">
          <RotateCcw /> Reintentar
        </AppButton>
      </div>

      <!-- Carga -->
      <div v-else-if="alertsLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
        <SkeletonBlock v-for="n in 4" :key="n" height="44px" />
      </div>

      <!-- Datos -->
      <DataTable
        v-else
        :columns="alertColumns"
        :rows="lowStockAlerts"
        row-key="message"
        min-width="820px"
      >
        <template #severity="{ row }">
          <span
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
              SEVERITY_BADGE[asAlert(row).severity],
            ]"
          >
            <span class="h-[7px] w-[7px] rounded-full bg-current" />
            {{ SEVERITY_LABELS[asAlert(row).severity] }}
          </span>
        </template>

        <template #resource="{ row }">
          <div>
            <p class="font-semibold text-neutral-900">
              {{ asAlert(row).metadata.resource_name ?? '—' }}
            </p>
            <span
              v-if="asAlert(row).metadata.category"
              :class="[
                'mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                RESOURCE_CATEGORY_BADGE[asAlert(row).metadata.category as ResourceCategory],
              ]"
            >
              {{ RESOURCE_CATEGORY_LABELS[asAlert(row).metadata.category as ResourceCategory] }}
            </span>
          </div>
        </template>

        <template #detail="{ row }">
          <p class="text-neutral-700">{{ asAlert(row).message }}</p>
          <p v-if="asAlert(row).metadata.warehouse_name" class="text-xs text-neutral-500">
            {{ asAlert(row).metadata.warehouse_name }}
          </p>
        </template>

        <template #stock="{ row }">
          <span class="font-mono text-xs">
            <strong
              :class="asAlert(row).metadata.available_quantity === 0 ? 'text-danger' : 'text-neutral-900'"
            >{{ asAlert(row).metadata.available_quantity ?? '—' }}</strong>
            <span class="text-neutral-400"> / {{ asAlert(row).metadata.threshold ?? '—' }}</span>
          </span>
        </template>

        <template #actions="{ row }">
          <AppButton
            v-if="asAlert(row).link"
            variant="ghost"
            size="sm"
            title="Ver bodega"
            @click="goToLink(asAlert(row).link)"
          >
            <ExternalLink />
          </AppButton>
        </template>

        <template #empty>
          <EmptyState
            title="Sin alertas de stock bajo"
            message="Todos los recursos están por encima de su umbral mínimo."
          >
            <template #icon><ShieldCheck /></template>
          </EmptyState>
        </template>
      </DataTable>

      <!-- Otras alertas de inventario (vencimientos / capacidad). Solo si existen. -->
      <template v-if="!alertsLoading && !alertsError && otherAlerts.length">
        <h3 class="pt-2 text-sm font-semibold text-neutral-600">
          Otras alertas de inventario
        </h3>
        <DataTable :columns="otherColumns" :rows="otherAlerts" row-key="message" min-width="720px">
          <template #severity="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                SEVERITY_BADGE[asAlert(row).severity],
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ SEVERITY_LABELS[asAlert(row).severity] }}
            </span>
          </template>
          <template #kind="{ row }">
            <span class="text-xs font-medium text-neutral-600">
              {{ ALERT_KIND_LABELS[asAlert(row).kind] }}
            </span>
          </template>
          <template #detail="{ row }">
            <p class="text-neutral-700">{{ asAlert(row).message }}</p>
          </template>
          <template #actions="{ row }">
            <AppButton
              v-if="asAlert(row).link"
              variant="ghost"
              size="sm"
              title="Ver"
              @click="goToLink(asAlert(row).link)"
            >
              <ExternalLink />
            </AppButton>
          </template>
        </DataTable>
      </template>
    </div>

    <!-- Sección 2: configuración de umbrales (CA2) — solo logística ----------- -->
    <RoleGate :roles="[...EDIT_ROLES]">
      <div class="space-y-3">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <Sliders class="h-5 w-5 text-primary-600" /> Configuración de umbrales
            </h2>
            <p class="mt-0.5 text-sm text-neutral-500">
              Define la cantidad mínima por recurso. Sin umbral propio se usa el valor global
              ({{ GLOBAL_DEFAULT_THRESHOLD }}).
            </p>
          </div>
          <div class="w-full sm:w-64">
            <SelectField v-model="categoryFilter" :options="categoryFilterOptions" />
          </div>
        </div>

        <!-- Error -->
        <div v-if="thrError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
          <p class="text-sm text-danger">No se pudieron cargar los umbrales.</p>
          <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetchThresholds()">
            <RotateCcw /> Reintentar
          </AppButton>
        </div>

        <!-- Carga -->
        <div v-else-if="thresholdsBusy" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
        </div>

        <!-- Datos -->
        <DataTable
          v-else
          :columns="thresholdColumns"
          :rows="thresholdRows"
          row-key="resource_type_id"
          min-width="720px"
        >
          <template #resource="{ row }">
            <span
              class="font-semibold"
              :class="asThresholdRow(row).is_active ? 'text-neutral-900' : 'text-neutral-400'"
            >
              {{ asThresholdRow(row).name }}
            </span>
            <span class="ml-1 text-xs text-neutral-400">({{ asThresholdRow(row).unit_of_measure }})</span>
          </template>

          <template #category="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                RESOURCE_CATEGORY_BADGE[asThresholdRow(row).category],
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ RESOURCE_CATEGORY_LABELS[asThresholdRow(row).category] }}
            </span>
          </template>

          <template #threshold="{ row }">
            <!-- Modo edición inline -->
            <div
              v-if="editingId === asThresholdRow(row).resource_type_id"
              class="flex flex-col items-center gap-1"
            >
              <input
                :id="inputIdFor(asThresholdRow(row).resource_type_id)"
                v-model="editValue"
                type="number"
                min="0"
                step="1"
                class="control w-28 text-center"
                @keyup.enter="saveEdit(asThresholdRow(row))"
                @keyup.esc="cancelEdit"
              />
              <span v-if="editError" class="text-xs text-danger">{{ editError }}</span>
            </div>
            <!-- Modo lectura -->
            <span v-else class="font-mono text-sm">
              <template v-if="asThresholdRow(row).min_quantity != null">
                <strong class="text-neutral-900">{{ asThresholdRow(row).min_quantity }}</strong>
              </template>
              <template v-else>
                <span class="text-neutral-400">{{ GLOBAL_DEFAULT_THRESHOLD }} (global)</span>
              </template>
            </span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <template v-if="editingId === asThresholdRow(row).resource_type_id">
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="text-success"
                  title="Guardar"
                  :disabled="saving"
                  @click="saveEdit(asThresholdRow(row))"
                >
                  <Check />
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  title="Cancelar"
                  :disabled="saving"
                  @click="cancelEdit"
                >
                  <X />
                </AppButton>
              </template>
              <AppButton
                v-else
                variant="ghost"
                size="sm"
                title="Editar umbral"
                :disabled="editingId !== null"
                @click="startEdit(asThresholdRow(row))"
              >
                <Pencil />
              </AppButton>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin recursos"
              :message="hasThresholdFilter
                ? 'No hay recursos en esta categoría.'
                : 'Aún no se han registrado tipos de recurso.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasThresholdFilter" variant="outline" size="sm" @click="categoryFilter = ''">
                  <RotateCcw /> Limpiar filtro
                </AppButton>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>
    </RoleGate>
  </section>
</template>
