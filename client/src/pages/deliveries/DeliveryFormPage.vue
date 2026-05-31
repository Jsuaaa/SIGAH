<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Plus, Trash2, TriangleAlert, CheckCircle2, MapPin, Search, Crosshair, Loader2, ShieldAlert,
} from '@lucide/vue'
import { useFamiliesList } from '@/composables/useFamilies'
import { useAllWarehouses } from '@/composables/useWarehouses'
import { useAllResourceTypes } from '@/composables/useResourceTypes'
import { useDeliveryEligibility, useDeliveryMutations } from '@/composables/useDeliveries'
import { deliveriesApi } from '@/api/deliveries.api'
import { deliverySchema, deliveryExceptionSchema } from '@/schemas/delivery.schema'
import type {
  DeliveryDetailPayload,
  DeliveryExceptionPayload,
  DeliveryPayload,
  NearestWarehouse,
} from '@/types/delivery.types'
import type { Family } from '@/types/family.types'
import { useAuthStore } from '@/stores/auth'
import { validate } from '@/utils/validation'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
import { FOOD_KG_PER_PERSON_DAY, MIN_COVERAGE_DAYS } from '@/utils/constants'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StepperNav from '@/components/ui/StepperNav.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const auth = useAuthStore()
const { create, createException } = useDeliveryMutations()

const STEPS = ['Familia', 'Bodega', 'Recursos', 'Confirmar']
const step = ref(0)

// ---------------------------------------------------------------------------
// Paso 1 — Familia + elegibilidad (RN-02, HU-23 CA2)
// ---------------------------------------------------------------------------
const familySearch = ref('')
const selectedFamily = ref<Family | null>(null)

// Búsqueda de familias por texto (código / documento / dirección). Reutiliza useFamiliesList
// con `q`, que enruta a /families/search.
const searchParams = computed(() => ({ page: 1, limit: 10, q: familySearch.value }))
const familiesQuery = useFamiliesList(searchParams)
const familyResults = computed<Family[]>(() => (familySearch.value ? familiesQuery.data.value?.data ?? [] : []))

const selectedFamilyId = computed<number | null>(() => selectedFamily.value?.id ?? null)
const eligibilityQuery = useDeliveryEligibility(selectedFamilyId)
const eligibility = computed(() => eligibilityQuery.data.value ?? null)
const eligible = computed(() => eligibility.value?.is_eligible === true)
const blockedByCoverage = computed(
  () => eligibility.value != null && !eligibility.value.is_eligible,
)
// RN-02: "Faltan X días" hasta que la cobertura vigente venza.
const daysRemaining = computed(() => {
  const d = eligibility.value?.days_remaining
  return typeof d === 'number' && d > 0 ? d : null
})

function pickFamily(f: Family) {
  selectedFamily.value = f
  familySearch.value = ''
}
function clearFamily() {
  selectedFamily.value = null
}

// ---------------------------------------------------------------------------
// Paso 2 — Bodega origen (manual o "más cercana", HU-12)
// ---------------------------------------------------------------------------
const warehousesQuery = useAllWarehouses()
const sourceWarehouseId = ref<string | number>('')

const warehouseOptions = computed(() => [
  { value: '', label: 'Selecciona la bodega origen' },
  ...(warehousesQuery.data.value ?? []).map((w) => ({ value: w.id, label: w.name })),
])

// Resultado de "bodega más cercana" (GET /warehouses/nearest).
const nearestList = ref<NearestWarehouse[]>([])
const nearestLoading = ref(false)
const nearestError = ref('')
const nearestTried = ref(false)

async function fetchNearest(lat: number, lng: number) {
  nearestLoading.value = true
  nearestError.value = ''
  nearestTried.value = true
  try {
    nearestList.value = await deliveriesApi.nearestWarehouses(lat, lng, 5)
    // Autoselecciona la más cercana con disponibilidad (HU-12).
    if (nearestList.value.length > 0) {
      sourceWarehouseId.value = nearestList.value[0].id
    }
  } catch (e) {
    nearestError.value = apiErrorMessage(e, 'No se pudo calcular la bodega más cercana.')
    nearestList.value = []
  } finally {
    nearestLoading.value = false
  }
}

// Usa las coordenadas registradas de la familia si existen.
function useFamilyLocation() {
  const f = selectedFamily.value
  if (!f || f.latitude == null || f.longitude == null) {
    toast.error('La familia no tiene ubicación registrada. Usa la ubicación del dispositivo.')
    return
  }
  fetchNearest(f.latitude, f.longitude)
}

// Usa la geolocalización del dispositivo (operador en terreno).
function useDeviceLocation() {
  if (!('geolocation' in navigator)) {
    toast.error('Este dispositivo no admite geolocalización.')
    return
  }
  nearestLoading.value = true
  nearestTried.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchNearest(pos.coords.latitude, pos.coords.longitude),
    () => {
      nearestLoading.value = false
      nearestError.value = 'No se pudo obtener la ubicación del dispositivo (permiso denegado).'
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

const familyHasLocation = computed(
  () => selectedFamily.value?.latitude != null && selectedFamily.value?.longitude != null,
)

function formatKm(km: number): string {
  return `${km.toLocaleString('es-CO', { maximumFractionDigits: 2 })} km`
}

// ---------------------------------------------------------------------------
// Paso 3 — Recursos + cálculo de cobertura en vivo (RN-01)
// ---------------------------------------------------------------------------
const resourceTypesQuery = useAllResourceTypes()

interface ItemRow {
  resource_type_id: string | number
  quantity: string | number
}

const form = reactive({
  coverage_days: String(MIN_COVERAGE_DAYS) as string | number,
  received_by_document: '',
  notes: '',
  items: [{ resource_type_id: '', quantity: '1' }] as ItemRow[],
})

const resourceOptions = computed(() => [
  { value: '', label: 'Selecciona un recurso' },
  ...(resourceTypesQuery.data.value ?? []).map((r) => ({
    value: r.id,
    label: `${r.name} (${r.unit_weight_kg} kg/u, ${r.category === 'FOOD' ? 'alimento' : 'no alimento'})`,
  })),
])

// Mapa id → tipo de recurso (peso unitario y categoría).
const resourceById = computed(() => {
  const map = new Map<number, { unit_weight_kg: number; category: string }>()
  for (const r of resourceTypesQuery.data.value ?? [])
    map.set(r.id, { unit_weight_kg: Number(r.unit_weight_kg) || 0, category: r.category })
  return map
})

function rowWeight(row: ItemRow): number {
  const id = Number(row.resource_type_id)
  const qty = Number(row.quantity)
  if (!id || !Number.isFinite(qty) || qty <= 0) return 0
  return qty * (resourceById.value.get(id)?.unit_weight_kg ?? 0)
}

// Peso total y peso de alimentos (FOOD) — la ración mínima RN-01 aplica solo a alimentos.
const totalWeight = computed(() => form.items.reduce((acc, row) => acc + rowWeight(row), 0))
const foodWeight = computed(() =>
  form.items.reduce((acc, row) => {
    const cat = resourceById.value.get(Number(row.resource_type_id))?.category
    return cat === 'FOOD' ? acc + rowWeight(row) : acc
  }, 0),
)

const members = computed(() => selectedFamily.value?.num_members ?? 0)
const coverageDays = computed(() => Number(form.coverage_days) || 0)

// Ración mínima de alimentos requerida = 0,6 kg × personas × días (RN-01).
const minFoodKg = computed(() => FOOD_KG_PER_PERSON_DAY * members.value * coverageDays.value)

// Días de cobertura que realmente alcanza el alimento cargado, dado el tamaño de la familia.
const achievedFoodDays = computed(() => {
  if (members.value <= 0) return 0
  return foodWeight.value / (FOOD_KG_PER_PERSON_DAY * members.value)
})

// RN-01: aviso si el alimento cargado no cubre la ración mínima de los días indicados.
const belowMinRation = computed(
  () => members.value > 0 && coverageDays.value >= MIN_COVERAGE_DAYS && foodWeight.value < minFoodKg.value,
)
// Aviso adicional: cobertura efectiva por debajo del mínimo legal de 3 días.
const coverageBelowMinDays = computed(
  () => members.value > 0 && foodWeight.value > 0 && achievedFoodDays.value < MIN_COVERAGE_DAYS,
)

function addItem() {
  form.items.push({ resource_type_id: '', quantity: '1' })
}
function removeItem(index: number) {
  form.items.splice(index, 1)
  if (form.items.length === 0) addItem()
}

// ---------------------------------------------------------------------------
// Excepción autorizada (HU-23 CA5) — solo COORDINADOR_LOGISTICA
// ---------------------------------------------------------------------------
const exceptionOpen = ref(false)
const exceptionReason = ref('')
const exceptionError = ref('')

function openException() {
  exceptionReason.value = ''
  exceptionError.value = ''
  exceptionOpen.value = true
}

// ---------------------------------------------------------------------------
// Navegación del stepper
// ---------------------------------------------------------------------------
const errors = reactive<Record<string, string>>({})
function resetErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
}

// Reglas para poder avanzar de paso.
const canLeaveFamily = computed(() => !!selectedFamily.value)
const canLeaveWarehouse = computed(() => !!sourceWarehouseId.value)
const itemsValid = computed(() =>
  form.items.some((r) => r.resource_type_id !== '' && Number(r.quantity) > 0),
)
const canLeaveItems = computed(() => coverageDays.value >= MIN_COVERAGE_DAYS && itemsValid.value)

function next() {
  if (step.value === 0 && !canLeaveFamily.value) {
    toast.error('Selecciona una familia para continuar.')
    return
  }
  if (step.value === 1 && !canLeaveWarehouse.value) {
    toast.error('Selecciona la bodega origen para continuar.')
    return
  }
  if (step.value === 2 && !canLeaveItems.value) {
    toast.error('Indica al menos un recurso y una cobertura de al menos 3 días.')
    return
  }
  step.value = Math.min(step.value + 1, STEPS.length - 1)
}
function prev() {
  step.value = Math.max(step.value - 1, 0)
}
function goBack() {
  router.push({ name: 'deliveries' })
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------
const submitting = computed(
  () => create.isPending.value || createException.isPending.value,
)

// Construye el payload base (común a entrega y excepción) tras validar con Zod.
function buildBasePayload(): DeliveryPayload | null {
  resetErrors()
  const items = form.items
    .filter((row) => row.resource_type_id !== '' || row.quantity !== '')
    .map((row) => ({
      resource_type_id: row.resource_type_id === '' ? undefined : row.resource_type_id,
      quantity: row.quantity === '' ? undefined : row.quantity,
    }))

  const result = validate(deliverySchema, {
    family_id: selectedFamily.value?.id,
    source_warehouse_id: sourceWarehouseId.value === '' ? undefined : sourceWarehouseId.value,
    coverage_days: form.coverage_days,
    received_by_document: form.received_by_document === '' ? undefined : form.received_by_document,
    delivery_latitude: selectedFamily.value?.latitude ?? undefined,
    delivery_longitude: selectedFamily.value?.longitude ?? undefined,
    notes: form.notes === '' ? undefined : form.notes,
    items,
  })

  if (!result.ok) {
    Object.assign(errors, result.errors)
    toast.error('Revisa los datos de la entrega.')
    return null
  }

  const data = result.data
  const details: DeliveryDetailPayload[] = data.items.map((it) => ({
    resource_type_id: it.resource_type_id,
    quantity: it.quantity,
  }))

  return {
    family_id: data.family_id,
    source_warehouse_id: data.source_warehouse_id,
    coverage_days: data.coverage_days,
    details,
    received_by_document: data.received_by_document ?? undefined,
    delivery_latitude: data.delivery_latitude ?? undefined,
    delivery_longitude: data.delivery_longitude ?? undefined,
    notes: data.notes ?? undefined,
  }
}

async function submit() {
  const payload = buildBasePayload()
  if (!payload) return

  try {
    const delivery = await create.mutateAsync({ payload })
    toast.success(`Entrega registrada: ${delivery.delivery_code}`)
    router.push({ name: 'deliveries' })
  } catch (e) {
    const status = apiErrorStatus(e)
    // RN-02 / HU-23: la familia tiene cobertura vigente → 409. Guiamos a la excepción.
    if (status === 409) {
      const msg = apiErrorMessage(
        e,
        'La familia tiene una cobertura vigente. Se requiere una excepción autorizada.',
      )
      toast.error(msg)
      if (auth.hasRole('COORDINADOR_LOGISTICA')) {
        openException()
      }
      return
    }
    // RN-01 / stock insuficiente → 422.
    if (status === 422) {
      toast.error(apiErrorMessage(e, 'La entrega no cumple las reglas (ración mínima o stock).'))
      return
    }
    toast.error(apiErrorMessage(e, 'No se pudo registrar la entrega.'))
  }
}

// Confirma la excepción autorizada (solo COORDINADOR_LOGISTICA).
async function submitException() {
  exceptionError.value = ''
  const base = buildBasePayload()
  if (!base) {
    exceptionOpen.value = false
    return
  }

  const authorizedBy = auth.user?.id
  if (!authorizedBy) {
    exceptionError.value = 'No se pudo identificar al usuario autorizante.'
    return
  }

  const candidate: DeliveryExceptionPayload = {
    ...base,
    exception_reason: exceptionReason.value.trim(),
    exception_authorized_by: authorizedBy,
  }

  const result = validate(deliveryExceptionSchema, {
    ...candidate,
    // El schema valida `items`; reconstruimos desde details para reusar la regla.
    items: candidate.details,
  })
  if (!result.ok) {
    exceptionError.value =
      result.errors.exception_reason ?? 'Indica una justificación de al menos 5 caracteres.'
    return
  }

  try {
    const delivery = await createException.mutateAsync(candidate)
    toast.success(`Entrega con excepción registrada: ${delivery.delivery_code}`)
    exceptionOpen.value = false
    router.push({ name: 'deliveries' })
  } catch (e) {
    exceptionError.value = apiErrorMessage(e, 'No se pudo registrar la excepción.')
  }
}

// Etiquetas para la pantalla de confirmación.
const selectedWarehouseName = computed(() => {
  const id = Number(sourceWarehouseId.value)
  return (warehousesQuery.data.value ?? []).find((w) => w.id === id)?.name ?? '—'
})
const resourceNameById = computed(() => {
  const map = new Map<number, string>()
  for (const r of resourceTypesQuery.data.value ?? []) map.set(r.id, r.name)
  return map
})
const confirmItems = computed(() =>
  form.items
    .filter((r) => r.resource_type_id !== '' && Number(r.quantity) > 0)
    .map((r) => ({
      name: resourceNameById.value.get(Number(r.resource_type_id)) ?? `#${r.resource_type_id}`,
      quantity: Number(r.quantity),
      weight: rowWeight(r),
    })),
)

// Si cambia la familia tras haber pasado de paso, reseteamos la bodega cercana.
watch(selectedFamily, () => {
  nearestList.value = []
  nearestTried.value = false
  nearestError.value = ''
})
</script>

<template>
  <section class="space-y-5">
    <PageHeader title="Registrar entrega" crumb="Entregas" subtitle="Entrega de ayuda a una familia">
      <template #actions>
        <AppButton variant="ghost" @click="goBack">Volver</AppButton>
      </template>
    </PageHeader>

    <div class="mx-auto max-w-3xl">
      <StepperNav :steps="STEPS" :current="step" class="mb-8" />

      <!-- ============================ PASO 1: FAMILIA ============================ -->
      <div v-show="step === 0" class="space-y-4">
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Familia destinataria</h4>

          <div v-if="!selectedFamily">
            <FormField label="Buscar familia" hint="Por código, documento del jefe o dirección.">
              <div class="relative">
                <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input v-model="familySearch" type="search" class="control pl-9" placeholder="FAM-2025-00001, cédula…" />
              </div>
            </FormField>

            <ul v-if="familyResults.length" class="mt-3 divide-y divide-neutral-100 overflow-hidden rounded-md border border-neutral-200">
              <li v-for="f in familyResults" :key="f.id">
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary-50"
                  @click="pickFamily(f)"
                >
                  <span>
                    <span class="font-mono text-xs font-semibold text-neutral-900">{{ f.family_code }}</span>
                    <span class="ml-2 text-sm text-neutral-600">Doc. {{ f.head_document }} · {{ f.num_members }} integrantes</span>
                  </span>
                  <span class="text-xs text-neutral-400">Seleccionar</span>
                </button>
              </li>
            </ul>
            <p v-else-if="familySearch && !familiesQuery.isFetching.value" class="mt-3 text-sm text-neutral-500">
              No se encontraron familias para «{{ familySearch }}».
            </p>
          </div>

          <!-- Familia seleccionada + elegibilidad -->
          <div v-else class="space-y-3">
            <div class="flex items-start justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div>
                <p class="font-mono text-sm font-semibold text-neutral-900">{{ selectedFamily.family_code }}</p>
                <p class="text-sm text-neutral-600">
                  Doc. {{ selectedFamily.head_document }} · {{ selectedFamily.num_members }} integrantes
                </p>
              </div>
              <AppButton variant="ghost" size="sm" @click="clearFamily">Cambiar</AppButton>
            </div>

            <!-- Estado de elegibilidad -->
            <div v-if="eligibilityQuery.isFetching.value" class="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-500">
              <Loader2 class="h-4 w-4 animate-spin" /> Consultando elegibilidad…
            </div>

            <div
              v-else-if="eligible"
              class="flex items-start gap-2 rounded-md border border-success-br bg-success-bg p-3 text-sm text-success"
            >
              <CheckCircle2 class="mt-0.5 h-[18px] w-[18px] shrink-0" />
              <div>
                <p class="font-semibold">Familia elegible para recibir una entrega.</p>
                <p v-if="eligibility?.last_delivery_at" class="mt-0.5 text-success/80">
                  Última entrega: {{ new Date(eligibility.last_delivery_at).toLocaleDateString('es-CO') }}.
                </p>
              </div>
            </div>

            <div
              v-else-if="blockedByCoverage"
              class="flex items-start gap-2 rounded-md border border-danger-br bg-danger-bg p-3 text-sm text-danger"
            >
              <ShieldAlert class="mt-0.5 h-[18px] w-[18px] shrink-0" />
              <div class="flex-1">
                <p class="font-semibold">
                  Entrega bloqueada: cobertura vigente.
                  <template v-if="daysRemaining"> Faltan {{ daysRemaining }} días.</template>
                </p>
                <p class="mt-0.5 text-danger/80">
                  <template v-if="eligibility?.coverage_expires">
                    La cobertura vence el {{ new Date(eligibility.coverage_expires).toLocaleDateString('es-CO') }}.
                  </template>
                  Una entrega antes de esa fecha requiere una excepción autorizada (RN-02).
                </p>
                <!-- HU-23 CA5: autorizar excepción solo para COORDINADOR_LOGISTICA -->
                <RoleGate :roles="['COORDINADOR_LOGISTICA']">
                  <AppButton variant="danger" size="sm" class="mt-3" @click="openException">
                    <ShieldAlert /> Autorizar excepción
                  </AppButton>
                </RoleGate>
              </div>
            </div>

            <div
              v-else-if="eligibilityQuery.isError.value"
              class="rounded-md border border-warning-br bg-warning-bg p-3 text-sm text-warning"
            >
              No se pudo consultar la elegibilidad de la familia.
            </div>
          </div>
        </div>
      </div>

      <!-- ============================ PASO 2: BODEGA ============================ -->
      <div v-show="step === 1" class="space-y-4">
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Bodega origen</h4>

          <SelectField
            v-model="sourceWarehouseId"
            label="Bodega"
            required
            :options="warehouseOptions"
            :error="errors.source_warehouse_id"
            :disabled="warehousesQuery.isLoading.value"
          />

          <!-- HU-12: bodega más cercana -->
          <div class="rounded-md border border-neutral-200 bg-neutral-50 p-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                <MapPin class="h-4 w-4" /> Bodega más cercana
              </p>
              <div class="flex flex-wrap gap-2">
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="!familyHasLocation || nearestLoading"
                  title="Usa las coordenadas registradas de la familia"
                  @click="useFamilyLocation"
                >
                  <MapPin /> Ubicación de la familia
                </AppButton>
                <AppButton
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="nearestLoading"
                  title="Usa la ubicación del dispositivo"
                  @click="useDeviceLocation"
                >
                  <Crosshair /> Mi ubicación
                </AppButton>
              </div>
            </div>

            <p v-if="!familyHasLocation" class="mt-2 text-xs text-neutral-500">
              La familia no tiene ubicación registrada; usa la ubicación del dispositivo.
            </p>

            <div v-if="nearestLoading" class="mt-3 flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 class="h-4 w-4 animate-spin" /> Calculando distancias…
            </div>

            <p v-else-if="nearestError" class="mt-3 text-sm text-danger">{{ nearestError }}</p>

            <!-- EmptyState si no hay bodegas con disponibilidad (HU-12 CA4) -->
            <EmptyState
              v-else-if="nearestTried && nearestList.length === 0"
              title="Sin bodegas disponibles"
              message="Ninguna bodega activa cercana tiene existencias en este momento."
            >
              <template #icon><MapPin /></template>
            </EmptyState>

            <ul v-else-if="nearestList.length" class="mt-3 space-y-2">
              <li
                v-for="w in nearestList"
                :key="w.id"
                class="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2"
                :class="Number(sourceWarehouseId) === w.id ? 'border-primary-400 ring-1 ring-primary-200' : 'border-neutral-200'"
              >
                <label class="flex flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="nearest-wh"
                    :value="w.id"
                    :checked="Number(sourceWarehouseId) === w.id"
                    @change="sourceWarehouseId = w.id"
                  />
                  <span class="text-sm text-neutral-800">{{ w.name }}</span>
                </label>
                <span class="font-mono text-xs text-neutral-500">{{ formatKm(w.distance_km) }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ============================ PASO 3: RECURSOS ============================ -->
      <div v-show="step === 2" class="space-y-4">
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Cobertura</h4>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Días de cobertura"
              required
              :error="errors.coverage_days"
              :hint="`Mínimo ${MIN_COVERAGE_DAYS} días (RN-01).`"
            >
              <input v-model="form.coverage_days" type="number" :min="MIN_COVERAGE_DAYS" class="control" />
            </FormField>
            <FormField label="Documento de quien recibe" :error="errors.received_by_document" hint="Opcional.">
              <input v-model="form.received_by_document" type="text" class="control" autocomplete="off" />
            </FormField>
          </div>
        </div>

        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Recursos entregados</h4>
            <AppButton type="button" variant="outline" size="sm" @click="addItem">
              <Plus /> Añadir recurso
            </AppButton>
          </div>

          <div class="space-y-3">
            <div
              v-for="(row, index) in form.items"
              :key="index"
              class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
            >
              <SelectField
                v-model="row.resource_type_id"
                :label="index === 0 ? 'Recurso' : undefined"
                :options="resourceOptions"
                :error="errors[`items.${index}.resource_type_id`]"
                :disabled="resourceTypesQuery.isLoading.value"
              />
              <FormField
                :label="index === 0 ? 'Cantidad' : undefined"
                :error="errors[`items.${index}.quantity`]"
              >
                <input v-model="row.quantity" type="number" min="1" class="control" />
              </FormField>
              <div class="flex items-center gap-3 pb-0.5">
                <span class="hidden text-xs whitespace-nowrap text-neutral-500 sm:inline">
                  {{ rowWeight(row).toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg
                </span>
                <AppButton type="button" variant="ghost" size="sm" class="text-danger" title="Quitar recurso" @click="removeItem(index)">
                  <Trash2 />
                </AppButton>
              </div>
            </div>
          </div>

          <p v-if="errors.items" class="text-sm text-danger">{{ errors.items }}</p>

          <!-- Cálculo de cobertura en vivo (RN-01) -->
          <div class="space-y-2 border-t border-neutral-200 pt-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-neutral-600">Ración mínima de alimentos requerida</span>
              <span class="font-mono text-neutral-900">
                {{ minFoodKg.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-neutral-600">Alimentos cargados</span>
              <span class="font-mono text-neutral-900">
                {{ foodWeight.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="font-semibold text-neutral-700">Peso total de la entrega</span>
              <span class="font-mono font-semibold text-neutral-900">
                {{ totalWeight.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg
              </span>
            </div>
            <p class="text-xs text-neutral-500">
              Cobertura efectiva de alimentos: {{ achievedFoodDays.toLocaleString('es-CO', { maximumFractionDigits: 1 }) }} días
              para {{ members }} integrantes (0,6 kg/persona/día).
            </p>
          </div>

          <!-- Avisos RN-01 -->
          <div
            v-if="belowMinRation"
            class="flex items-start gap-2 rounded-md border border-danger-br bg-danger-bg p-3 text-sm text-danger"
          >
            <TriangleAlert class="mt-0.5 h-[18px] w-[18px] shrink-0" />
            <p>
              Los alimentos cargados no cubren la ración mínima
              ({{ minFoodKg.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg).
              El backend rechazará la entrega (RN-01).
            </p>
          </div>
          <div
            v-else-if="coverageBelowMinDays"
            class="flex items-start gap-2 rounded-md border border-warning-br bg-warning-bg p-3 text-sm text-warning"
          >
            <TriangleAlert class="mt-0.5 h-[18px] w-[18px] shrink-0" />
            <p>La cobertura efectiva de alimentos es menor a {{ MIN_COVERAGE_DAYS }} días.</p>
          </div>
        </div>

        <div class="rounded-lg border border-neutral-200 bg-white p-5">
          <FormField label="Notas" :error="errors.notes" hint="Opcional. Máximo 1000 caracteres.">
            <textarea v-model="form.notes" rows="2" class="control" placeholder="Observaciones de la entrega…" />
          </FormField>
        </div>
      </div>

      <!-- ============================ PASO 4: CONFIRMAR ============================ -->
      <div v-show="step === 3" class="space-y-4">
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Confirmar entrega</h4>

          <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-neutral-500">Familia</dt>
              <dd class="font-medium text-neutral-900">
                {{ selectedFamily?.family_code }} · {{ members }} integrantes
              </dd>
            </div>
            <div>
              <dt class="text-neutral-500">Bodega origen</dt>
              <dd class="font-medium text-neutral-900">{{ selectedWarehouseName }}</dd>
            </div>
            <div>
              <dt class="text-neutral-500">Cobertura</dt>
              <dd class="font-medium text-neutral-900">{{ coverageDays }} días</dd>
            </div>
            <div>
              <dt class="text-neutral-500">Peso total</dt>
              <dd class="font-medium text-neutral-900">
                {{ totalWeight.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg
              </dd>
            </div>
          </dl>

          <div class="border-t border-neutral-200 pt-3">
            <p class="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Recursos</p>
            <ul class="space-y-1 text-sm">
              <li v-for="(it, i) in confirmItems" :key="i" class="flex items-center justify-between">
                <span class="text-neutral-700">{{ it.quantity }}× {{ it.name }}</span>
                <span class="font-mono text-xs text-neutral-500">
                  {{ it.weight.toLocaleString('es-CO', { maximumFractionDigits: 2 }) }} kg
                </span>
              </li>
            </ul>
          </div>

          <div
            v-if="blockedByCoverage"
            class="flex items-start gap-2 rounded-md border border-danger-br bg-danger-bg p-3 text-sm text-danger"
          >
            <ShieldAlert class="mt-0.5 h-[18px] w-[18px] shrink-0" />
            <div>
              <p class="font-semibold">La familia tiene cobertura vigente.</p>
              <p class="mt-0.5">
                Registrar esta entrega requiere una excepción autorizada por un coordinador de logística.
              </p>
              <RoleGate :roles="['COORDINADOR_LOGISTICA']">
                <AppButton variant="danger" size="sm" class="mt-3" @click="openException">
                  <ShieldAlert /> Autorizar excepción
                </AppButton>
              </RoleGate>
            </div>
          </div>

          <p class="text-xs text-neutral-500">
            Al registrar, el backend descuenta el inventario de la bodega origen (RN-05).
          </p>
        </div>
      </div>

      <!-- Navegación -->
      <div class="mt-6 flex justify-between gap-3">
        <AppButton v-if="step > 0" type="button" variant="ghost" @click="prev">Atrás</AppButton>
        <span v-else />
        <div class="flex gap-3">
          <AppButton type="button" variant="ghost" @click="goBack">Cancelar</AppButton>
          <AppButton v-if="step < STEPS.length - 1" type="button" @click="next">Siguiente</AppButton>
          <AppButton
            v-else
            type="button"
            :disabled="submitting || blockedByCoverage"
            :title="blockedByCoverage ? 'Requiere excepción autorizada' : undefined"
            @click="submit"
          >
            {{ submitting ? 'Registrando…' : 'Registrar entrega' }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Dialog de excepción autorizada (HU-23 CA5) -->
    <BaseModal :open="exceptionOpen" title="Autorizar excepción de cobertura" @close="exceptionOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-neutral-600">
          La familia <strong>{{ selectedFamily?.family_code }}</strong> tiene una cobertura vigente.
          Justifica por qué se autoriza una nueva entrega (RN-02 / HU-23 CA5).
        </p>
        <FormField label="Justificación" required :error="exceptionError" hint="Mínimo 5 caracteres.">
          <textarea
            v-model="exceptionReason"
            rows="3"
            class="control"
            placeholder="Motivo de la excepción autorizada…"
          />
        </FormField>
      </div>
      <template #footer>
        <AppButton variant="ghost" @click="exceptionOpen = false">Cancelar</AppButton>
        <AppButton
          variant="danger"
          :disabled="createException.isPending.value"
          @click="submitException"
        >
          {{ createException.isPending.value ? 'Registrando…' : 'Confirmar excepción' }}
        </AppButton>
      </template>
    </BaseModal>
  </section>
</template>
