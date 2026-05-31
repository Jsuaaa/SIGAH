<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Plus, Trash2, TriangleAlert } from '@lucide/vue'
import { useAllDonors } from '@/composables/useDonors'
import { useAllWarehouses } from '@/composables/useWarehouses'
import { useAllResourceTypes } from '@/composables/useResourceTypes'
import { useDonationMutations } from '@/composables/useDonations'
import { donationSchema } from '@/schemas/donation.schema'
import {
  DONATION_TYPE_OPTIONS,
  type DonationType,
  type DonationPayload,
  type DonationItemPayload,
} from '@/types/donation.types'
import { validate } from '@/utils/validation'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'

const router = useRouter()

const donorsQuery = useAllDonors()
const warehousesQuery = useAllWarehouses()
const resourceTypesQuery = useAllResourceTypes()
const { create } = useDonationMutations()

// Hoy en formato YYYY-MM-DD para el input date.
const today = new Date().toISOString().slice(0, 10)

interface ItemRow {
  resource_type_id: string | number
  quantity: string | number
}

const form = reactive({
  donor_id: '' as string | number,
  donation_type: 'IN_KIND' as DonationType,
  destination_warehouse_id: '' as string | number,
  monetary_amount: '' as string | number,
  date: today,
  notes: '',
  items: [{ resource_type_id: '', quantity: '1' }] as ItemRow[],
})

const errors = reactive<Record<string, string>>({})
function resetErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
}

// --- Opciones de selects ------------------------------------------------------
const donorOptions = computed(() => [
  { value: '', label: 'Selecciona un donante' },
  ...(donorsQuery.data.value ?? []).map((d) => ({ value: d.id, label: d.name })),
])
const warehouseOptions = computed(() => [
  { value: '', label: 'Selecciona la bodega destino' },
  ...(warehousesQuery.data.value ?? []).map((w) => ({ value: w.id, label: w.name })),
])
const resourceOptions = computed(() => [
  { value: '', label: 'Selecciona un recurso' },
  ...(resourceTypesQuery.data.value ?? []).map((r) => ({
    value: r.id,
    label: `${r.name} (${r.unit_weight_kg} kg/u)`,
  })),
])

// --- Banderas por tipo --------------------------------------------------------
const isInKind = computed(() => form.donation_type === 'IN_KIND')
const isMonetary = computed(() => form.donation_type === 'MONETARY')
const isMixed = computed(() => form.donation_type === 'MIXED')
// En especie: hay items y bodega. Monetaria: solo monto. Mixta: ambos.
const showItems = computed(() => isInKind.value || isMixed.value)
const showAmount = computed(() => isMonetary.value || isMixed.value)

// --- Cálculo de peso en vivo --------------------------------------------------
// Peso unitario del recurso seleccionado (resource_types.unit_weight_kg).
const unitWeightById = computed(() => {
  const map = new Map<number, number>()
  for (const r of resourceTypesQuery.data.value ?? []) map.set(r.id, Number(r.unit_weight_kg) || 0)
  return map
})

function rowWeight(row: ItemRow): number {
  const id = Number(row.resource_type_id)
  const qty = Number(row.quantity)
  if (!id || !Number.isFinite(qty) || qty <= 0) return 0
  return qty * (unitWeightById.value.get(id) ?? 0)
}

// Σ quantity × unit_weight_kg de todos los renglones (solo si aplica a inventario).
const projectedWeight = computed(() => {
  if (!showItems.value) return 0
  return form.items.reduce((acc, row) => acc + rowWeight(row), 0)
})

// Bodega destino seleccionada (para el aviso de capacidad).
const selectedWarehouse = computed(() => {
  const id = Number(form.destination_warehouse_id)
  if (!id) return null
  return (warehousesQuery.data.value ?? []).find((w) => w.id === id) ?? null
})

// Peso proyectado tras registrar = ocupación actual + peso de esta donación.
const projectedTotalWeight = computed(() =>
  selectedWarehouse.value ? selectedWarehouse.value.current_weight_kg + projectedWeight.value : 0,
)

// RN-03: aviso anticipado si el peso proyectado supera la capacidad máxima de la
// bodega destino. El backend lo rechaza con SH422; aquí avisamos antes de enviar.
const exceedsCapacity = computed(() => {
  const w = selectedWarehouse.value
  if (!w || !showItems.value || projectedWeight.value <= 0) return false
  return projectedTotalWeight.value > w.max_capacity_kg
})

function formatKg(kg: number): string {
  return `${kg.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`
}

// --- Filas dinámicas de items -------------------------------------------------
function addItem() {
  form.items.push({ resource_type_id: '', quantity: '1' })
}
function removeItem(index: number) {
  form.items.splice(index, 1)
  if (form.items.length === 0) addItem()
}

// --- Envío --------------------------------------------------------------------
const submitting = computed(() => create.isPending.value)

function goBack() {
  router.push({ name: 'donations' })
}

async function submit() {
  resetErrors()

  // Solo enviamos al validador los items cuando el tipo los requiere.
  const items = showItems.value
    ? form.items
        .filter((row) => row.resource_type_id !== '' || row.quantity !== '')
        .map((row) => ({
          resource_type_id: row.resource_type_id === '' ? undefined : row.resource_type_id,
          quantity: row.quantity === '' ? undefined : row.quantity,
        }))
    : []

  const result = validate(donationSchema, {
    donor_id: form.donor_id === '' ? undefined : form.donor_id,
    donation_type: form.donation_type,
    destination_warehouse_id:
      showItems.value && form.destination_warehouse_id !== ''
        ? form.destination_warehouse_id
        : undefined,
    monetary_amount: showAmount.value && form.monetary_amount !== '' ? form.monetary_amount : undefined,
    date: form.date || undefined,
    notes: form.notes === '' ? undefined : form.notes,
    items,
  })

  if (!result.ok) {
    Object.assign(errors, result.errors)
    // Errores a nivel de array de items: los mostramos en su sección.
    return
  }

  const data = result.data

  // Reglas condicionales por tipo (RN del backend). Se validan aquí, tras la
  // forma de los campos, para dar errores por campo claros.
  let hasConditionalError = false
  if (showItems.value) {
    if (!data.destination_warehouse_id) {
      errors.destination_warehouse_id = 'Selecciona la bodega destino'
      hasConditionalError = true
    }
    if (!data.items || data.items.length === 0) {
      errors.items = 'Agrega al menos un recurso a la donación'
      hasConditionalError = true
    }
  }
  if (showAmount.value && !(data.monetary_amount != null && data.monetary_amount > 0)) {
    errors.monetary_amount = 'Ingresa el monto (mayor que 0)'
    hasConditionalError = true
  }
  if (hasConditionalError) return

  // Construimos el cuerpo EXACTO que espera el backend (destination_warehouse_id,
  // monetary_amount, details). Omitimos lo que no aplica al tipo.
  const payload: DonationPayload = {
    donor_id: data.donor_id,
    donation_type: data.donation_type,
    date: data.date ?? undefined,
    notes: data.notes ?? undefined,
  }

  if (showItems.value) {
    payload.destination_warehouse_id = data.destination_warehouse_id ?? undefined
    payload.details = (data.items ?? []).map(
      (it): DonationItemPayload => ({
        resource_type_id: it.resource_type_id,
        quantity: it.quantity,
      }),
    )
  }
  if (showAmount.value) {
    // El backend acepta string/number; enviamos número.
    payload.monetary_amount = data.monetary_amount ?? undefined
  }

  try {
    const donation = await create.mutateAsync(payload)
    toast.success(`Donación registrada: ${donation.donation_code}`)
    router.push({ name: 'donations' })
  } catch (e) {
    // RN-03: capacidad excedida en la bodega destino → SH422 (HTTP 422).
    if (apiErrorStatus(e) === 422) {
      const msg = apiErrorMessage(
        e,
        'La donación supera la capacidad máxima de la bodega destino.',
      )
      errors.destination_warehouse_id = msg
      toast.error(msg)
      return
    }
    toast.error(apiErrorMessage(e, 'No se pudo registrar la donación.'))
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader title="Registrar donación" crumb="Donaciones" subtitle="Ingreso de donación recibida">
      <template #actions>
        <AppButton variant="ghost" @click="goBack">Volver</AppButton>
      </template>
    </PageHeader>

    <form class="max-w-3xl space-y-6" @submit.prevent="submit">
      <!-- Sección: datos generales -->
      <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Datos generales</h4>

        <SelectField
          v-model="form.donor_id"
          label="Donante"
          required
          :options="donorOptions"
          :error="errors.donor_id"
          :disabled="donorsQuery.isLoading.value"
        />

        <SelectField
          v-model="form.donation_type"
          label="Tipo de donación"
          required
          :options="DONATION_TYPE_OPTIONS"
          :error="errors.donation_type"
        />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Fecha" :error="errors.date">
            <input v-model="form.date" type="date" class="control" />
          </FormField>
        </div>

        <FormField label="Notas" :error="errors.notes" hint="Opcional. Máximo 1000 caracteres.">
          <textarea v-model="form.notes" rows="2" class="control" placeholder="Observaciones de la donación…" />
        </FormField>
      </div>

      <!-- Sección: monto (MONETARY / MIXED) -->
      <div v-if="showAmount" class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Aporte monetario</h4>
        <FormField label="Monto (COP)" required :error="errors.monetary_amount">
          <input
            v-model="form.monetary_amount"
            type="number"
            min="0"
            step="0.01"
            class="control"
            placeholder="Ej. 500000"
          />
        </FormField>
      </div>

      <!-- Sección: items en especie (IN_KIND / MIXED) -->
      <div v-if="showItems" class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase">Recursos en especie</h4>
          <AppButton type="button" variant="outline" size="sm" @click="addItem">
            <Plus /> Añadir recurso
          </AppButton>
        </div>

        <SelectField
          v-model="form.destination_warehouse_id"
          label="Bodega destino"
          required
          :options="warehouseOptions"
          :error="errors.destination_warehouse_id"
          :disabled="warehousesQuery.isLoading.value"
        />

        <!-- Aviso anticipado de capacidad excedida (RN-03) -->
        <div
          v-if="exceedsCapacity && selectedWarehouse"
          class="flex items-start gap-2 rounded-md border border-danger-br bg-danger-bg p-3 text-sm text-danger"
        >
          <TriangleAlert class="mt-0.5 h-[18px] w-[18px] shrink-0" />
          <div>
            <p class="font-semibold">El peso proyectado supera la capacidad de la bodega.</p>
            <p class="mt-0.5">
              Capacidad máxima: {{ formatKg(selectedWarehouse.max_capacity_kg) }} ·
              Ocupación actual: {{ formatKg(selectedWarehouse.current_weight_kg) }} ·
              Tras esta donación: {{ formatKg(projectedTotalWeight) }}.
            </p>
          </div>
        </div>

        <!-- Filas dinámicas de items -->
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
                {{ formatKg(rowWeight(row)) }}
              </span>
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                class="text-danger"
                title="Quitar recurso"
                @click="removeItem(index)"
              >
                <Trash2 />
              </AppButton>
            </div>
          </div>
        </div>

        <!-- Error a nivel del array de items (al menos 1 requerido). -->
        <p v-if="errors.items" class="text-sm text-danger">{{ errors.items }}</p>

        <!-- Peso total en vivo -->
        <div class="flex items-center justify-between border-t border-neutral-200 pt-3 text-sm">
          <span class="font-semibold text-neutral-700">Peso total de la donación</span>
          <span class="font-mono font-semibold text-neutral-900">{{ formatKg(projectedWeight) }}</span>
        </div>
      </div>

      <!-- Acciones -->
      <div class="flex justify-end gap-3">
        <AppButton type="button" variant="ghost" @click="goBack">Cancelar</AppButton>
        <AppButton type="submit" :disabled="submitting">
          {{ submitting ? 'Registrando…' : 'Registrar donación' }}
        </AppButton>
      </div>
    </form>
  </section>
</template>
