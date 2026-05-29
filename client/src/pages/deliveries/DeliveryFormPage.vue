<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ArrowLeft, Save, Plus, Trash2, Search, CheckCircle2, XCircle, ShieldAlert,
} from '@lucide/vue'
import { useFamiliesList } from '@/composables/useFamilies'
import { useDeliveryEligibility, useDeliveryMutations } from '@/composables/useDeliveries'
import { useWarehouses } from '@/composables/useWarehouses'
import { useResourceTypes } from '@/composables/useResourceTypes'
import { useAuthStore } from '@/stores/auth'
import type { Family, FamilyListParams } from '@/types/family.types'
import type { DeliveryDetailInput, DeliveryPayload, ExceptionPayload } from '@/types/delivery.types'
import type { ResourceTypeListParams } from '@/types/inventory.types'
import { FOOD_KG_PER_PERSON_DAY, MIN_COVERAGE_DAYS } from '@/utils/constants'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import MapPicker from '@/components/form/MapPicker.vue'

const router = useRouter()
const auth = useAuthStore()
const isCoord = computed(() => auth.hasRole('COORDINADOR_LOGISTICA'))

// --- Familia (búsqueda + selección) -------------------------------------------
const familyQuery = ref('')
const selectedFamily = ref<Family | null>(null)
const searchParams = computed<FamilyListParams>(() => ({
  page: 1,
  limit: 8,
  ...(familyQuery.value.trim().length >= 2 ? { q: familyQuery.value.trim() } : {}),
}))
const { data: familyResults } = useFamiliesList(searchParams)
const showResults = computed(() => familyQuery.value.trim().length >= 2 && !selectedFamily.value)

function pickFamily(f: Family) {
  selectedFamily.value = f
  familyQuery.value = ''
}
function clearFamily() {
  selectedFamily.value = null
}

const familyId = computed(() => selectedFamily.value?.id ?? 0)
const { data: eligibility, isFetching: checkingElig } = useDeliveryEligibility(familyId)

// --- Bodega + recursos --------------------------------------------------------
const { data: warehouses } = useWarehouses()
const activeResourceParams = ref<ResourceTypeListParams>({ is_active: true })
const { data: resourceTypes } = useResourceTypes(activeResourceParams)
const warehouseOptions = computed(() => [
  { value: '', label: 'Selecciona la bodega…' },
  ...(warehouses.value ?? []).map((w) => ({ value: String(w.id), label: w.name })),
])
const resourceOptions = computed(() => [
  { value: '', label: 'Recurso…' },
  ...(resourceTypes.value ?? []).map((rt) => ({ value: String(rt.id), label: `${rt.name} (${rt.unit_of_measure})` })),
])

const warehouseId = ref('')
const coverageDays = ref('7')
const receivedBy = ref('')
const notes = ref('')
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)

interface ItemRow {
  resource_type_id: string
  quantity: string
  batch: string
}
const items = ref<ItemRow[]>([{ resource_type_id: '', quantity: '', batch: '' }])
function addItem() {
  items.value.push({ resource_type_id: '', quantity: '', batch: '' })
}
function removeItem(i: number) {
  items.value.splice(i, 1)
}

// Cobertura mínima de alimentos sugerida (RN-01): 0,6 kg/persona/día.
const suggestedFoodKg = computed(() => {
  const members = selectedFamily.value?.num_members ?? 0
  const days = Number(coverageDays.value) || 0
  return members * days * FOOD_KG_PER_PERSON_DAY
})

// --- Excepción (HU-23 CA5) ----------------------------------------------------
const exceptionMode = ref(false)
const exceptionReason = ref('')
const isEligible = computed(() => eligibility.value?.is_eligible ?? true)
// Si no es elegible y no se autoriza excepción, el envío se bloquea.
const blockedByCoverage = computed(() => !isEligible.value && !exceptionMode.value)

const { create, createException } = useDeliveryMutations()
const saving = computed(() => create.isPending.value || createException.isPending.value)
const clientOpId = ref(crypto.randomUUID())

const errors = ref<Record<string, string>>({})
function validateForm() {
  const e: Record<string, string> = {}
  if (!selectedFamily.value) e.family = 'Selecciona una familia.'
  if (!warehouseId.value) e.warehouse = 'Selecciona la bodega de origen.'
  const cd = Number(coverageDays.value)
  if (!coverageDays.value || Number.isNaN(cd) || cd < MIN_COVERAGE_DAYS) {
    e.coverage = `La cobertura mínima es ${MIN_COVERAGE_DAYS} días (RN-01).`
  }
  if (!items.value.length || items.value.some((it) => !it.resource_type_id || !it.quantity || Number(it.quantity) <= 0 || !Number.isInteger(Number(it.quantity)))) {
    e.details = 'Cada ítem requiere un recurso y una cantidad entera mayor que 0.'
  }
  if (exceptionMode.value && exceptionReason.value.trim().length < 5) {
    e.exception = 'La justificación de la excepción es obligatoria (mín. 5 caracteres).'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function buildDetails(): DeliveryDetailInput[] {
  return items.value.map((it) => ({
    resource_type_id: Number(it.resource_type_id),
    quantity: Number(it.quantity),
    batch: it.batch.trim() || null,
  }))
}

async function submit() {
  if (!validateForm() || !selectedFamily.value) return
  const base = {
    family_id: selectedFamily.value.id,
    source_warehouse_id: Number(warehouseId.value),
    coverage_days: Number(coverageDays.value),
    received_by_document: receivedBy.value.trim() || null,
    delivery_latitude: latitude.value,
    delivery_longitude: longitude.value,
    notes: notes.value.trim() || null,
    details: buildDetails(),
  }
  try {
    if (exceptionMode.value) {
      const payload: ExceptionPayload = {
        ...base,
        exception_reason: exceptionReason.value.trim(),
        exception_authorized_by: auth.user!.id,
      }
      const created = await createException.mutateAsync(payload)
      toast.success(`Entrega ${created.delivery_code} creada con excepción`)
    } else {
      const payload: DeliveryPayload = { ...base, client_op_id: clientOpId.value }
      const created = await create.mutateAsync({ payload, clientOpId: clientOpId.value })
      toast.success(`Entrega ${created.delivery_code} registrada`)
    }
    router.push('/deliveries')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo registrar la entrega.'))
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-5">
    <PageHeader title="Crear entrega" crumb="Ayudas" subtitle="Entrega individual de ayuda a una familia">
      <template #actions>
        <AppButton variant="outline" @click="router.push('/deliveries')"><ArrowLeft /> Volver</AppButton>
      </template>
    </PageHeader>

    <form class="space-y-5" @submit.prevent="submit">
      <!-- 1. Familia -->
      <fieldset class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">1 · Familia</legend>

        <div v-if="!selectedFamily">
          <FormField label="Buscar familia" :error="errors.family" input-id="dv-fam" hint="Por código, documento o dirección (mín. 2 caracteres).">
            <div class="relative">
              <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input id="dv-fam" v-model="familyQuery" class="control pl-9" placeholder="FAM-2026-… / documento / dirección" />
            </div>
          </FormField>
          <ul v-if="showResults" class="mt-2 max-h-60 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            <li v-for="f in (familyResults?.data ?? [])" :key="f.id">
              <button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50" @click="pickFamily(f)">
                <span><span class="font-semibold text-neutral-900">{{ f.family_code }}</span> · <span class="font-mono text-xs">{{ f.head_document }}</span></span>
                <span class="text-xs text-neutral-500">{{ f.num_members }} miembros</span>
              </button>
            </li>
            <li v-if="!(familyResults?.data ?? []).length" class="px-3 py-3 text-center text-sm text-neutral-500">Sin resultados.</li>
          </ul>
        </div>

        <div v-else class="space-y-3">
          <div class="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <span class="text-sm">
              <span class="font-semibold text-neutral-900">{{ selectedFamily.family_code }}</span>
              · {{ selectedFamily.num_members }} miembros · doc {{ selectedFamily.head_document }}
            </span>
            <AppButton type="button" variant="ghost" size="sm" @click="clearFamily">Cambiar</AppButton>
          </div>

          <!-- Elegibilidad -->
          <div v-if="checkingElig" class="text-sm text-neutral-500">Verificando elegibilidad…</div>
          <div
            v-else-if="eligibility"
            :class="[
              'flex items-start gap-2 rounded-md border p-3 text-sm',
              eligibility.is_eligible ? 'border-success-br bg-success-bg text-success' : 'border-warning-br bg-warning-bg text-warning',
            ]"
          >
            <CheckCircle2 v-if="eligibility.is_eligible" class="mt-0.5 h-4 w-4 flex-none" />
            <XCircle v-else class="mt-0.5 h-4 w-4 flex-none" />
            <span v-if="eligibility.is_eligible">Familia elegible para una nueva entrega.</span>
            <span v-else>
              Cobertura vigente: faltan {{ eligibility.days_remaining ?? '—' }} día(s) para una nueva entrega (RN-02).
            </span>
          </div>

          <!-- Excepción (solo COORD) -->
          <div v-if="eligibility && !eligibility.is_eligible">
            <div v-if="isCoord">
              <label class="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input v-model="exceptionMode" type="checkbox" class="h-4 w-4 accent-primary-600" />
                <ShieldAlert class="h-4 w-4 text-warning" /> Autorizar entrega anticipada (excepción, HU-23 CA5)
              </label>
              <FormField v-if="exceptionMode" label="Justificación de la excepción" required :error="errors.exception" input-id="dv-exc" class="mt-2">
                <textarea id="dv-exc" v-model="exceptionReason" rows="2" class="control" placeholder="Motivo de la entrega anticipada…" />
              </FormField>
            </div>
            <p v-else class="text-xs text-neutral-500">Solo un Coordinador de logística puede autorizar una entrega anticipada.</p>
          </div>
        </div>
      </fieldset>

      <!-- 2. Bodega + cobertura -->
      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">2 · Origen y cobertura</legend>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField v-model="warehouseId" label="Bodega de origen" required :options="warehouseOptions" :error="errors.warehouse" input-id="dv-wh" />
          <FormField label="Días de cobertura" required :error="errors.coverage" input-id="dv-cov" :hint="`Mínimo ${MIN_COVERAGE_DAYS} días (RN-01).`">
            <input id="dv-cov" v-model="coverageDays" type="number" :min="MIN_COVERAGE_DAYS" class="control" />
          </FormField>
        </div>
        <p v-if="selectedFamily" class="text-xs text-neutral-500">
          Alimento mínimo sugerido: <strong>{{ Math.round(suggestedFoodKg).toLocaleString('es-CO') }} kg</strong>
          ({{ FOOD_KG_PER_PERSON_DAY }} kg × {{ selectedFamily.num_members }} pers × {{ Number(coverageDays) || 0 }} días).
        </p>
      </fieldset>

      <!-- 3. Ítems -->
      <fieldset class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">3 · Ítems entregados</legend>
        <div
          v-for="(it, i) in items"
          :key="i"
          class="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <SelectField v-model="it.resource_type_id" :options="resourceOptions" />
          <FormField label="" input-id=""><input v-model="it.quantity" type="number" min="1" class="control" placeholder="Cantidad" /></FormField>
          <FormField label="" input-id=""><input v-model="it.batch" class="control" placeholder="Lote (opc.)" /></FormField>
          <div class="flex items-center justify-end">
            <AppButton type="button" variant="ghost" size="sm" class="text-danger" :disabled="items.length === 1" @click="removeItem(i)"><Trash2 /></AppButton>
          </div>
        </div>
        <p v-if="errors.details" class="text-sm text-danger">{{ errors.details }}</p>
        <AppButton type="button" variant="outline" size="sm" @click="addItem"><Plus /> Agregar ítem</AppButton>
      </fieldset>

      <!-- 4. Confirmación -->
      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">4 · Recepción y ubicación</legend>
        <FormField label="Recibido por (documento)" input-id="dv-rec" hint="Opcional">
          <input id="dv-rec" v-model="receivedBy" class="control" placeholder="Documento de quien recibe" />
        </FormField>
        <FormField label="Notas" input-id="dv-notes" hint="Opcional">
          <input id="dv-notes" v-model="notes" class="control" placeholder="Observaciones…" />
        </FormField>
        <FormField label="Ubicación de entrega" hint="Opcional. Toca el mapa para registrar dónde se entregó.">
          <MapPicker v-model:latitude="latitude" v-model:longitude="longitude" height="220px" />
        </FormField>
      </fieldset>

      <div class="flex items-center justify-end gap-3 pb-4">
        <AppButton variant="ghost" type="button" @click="router.push('/deliveries')">Cancelar</AppButton>
        <AppButton type="submit" :disabled="saving || blockedByCoverage">
          <Save /> {{ saving ? 'Registrando…' : exceptionMode ? 'Registrar con excepción' : 'Registrar entrega' }}
        </AppButton>
      </div>
      <p v-if="blockedByCoverage" class="-mt-2 pb-4 text-right text-xs text-warning">
        La familia tiene cobertura vigente. {{ isCoord ? 'Autoriza una excepción para continuar.' : 'No es posible registrar la entrega.' }}
      </p>
    </form>
  </section>
</template>
