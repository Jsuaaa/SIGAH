<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, Plus, Trash2, Save, TriangleAlert } from '@lucide/vue'
import { useDonors } from '@/composables/useDonors'
import { useWarehouses } from '@/composables/useWarehouses'
import { useResourceTypes } from '@/composables/useResourceTypes'
import { useDonationMutations } from '@/composables/useDonations'
import { DONATION_TYPE_OPTIONS } from '@/types/donation.types'
import type { DonationDetailInput, DonationPayload, DonationType } from '@/types/donation.types'
import type { ResourceTypeListParams } from '@/types/inventory.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'

const route = useRoute()
const router = useRouter()

const { data: donors } = useDonors()
const { data: warehouses } = useWarehouses()
const activeResourceParams = ref<ResourceTypeListParams>({ is_active: true })
const { data: resourceTypes } = useResourceTypes(activeResourceParams)
const { create } = useDonationMutations()
const saving = computed(() => create.isPending.value)

const todayStr = new Date().toISOString().slice(0, 10)
const form = ref({
  donor_id: (route.query.donor_id as string) || '',
  donation_type: 'IN_KIND' as DonationType,
  date: todayStr,
  notes: '',
  monetary_amount: '',
  destination_warehouse_id: '',
})
interface ItemRow {
  resource_type_id: string
  quantity: string
  batch: string
  expiration_date: string
}
const items = ref<ItemRow[]>([{ resource_type_id: '', quantity: '', batch: '', expiration_date: '' }])
const errors = ref<Record<string, string>>({})

const needsItems = computed(() => form.value.donation_type === 'IN_KIND' || form.value.donation_type === 'MIXED')
const needsMoney = computed(() => form.value.donation_type === 'MONETARY' || form.value.donation_type === 'MIXED')

const donorOptions = computed(() => [
  { value: '', label: 'Selecciona el donante…' },
  ...(donors.value ?? []).map((d) => ({ value: String(d.id), label: d.name })),
])
const warehouseOptions = computed(() => [
  { value: '', label: 'Selecciona la bodega…' },
  ...(warehouses.value ?? []).map((w) => ({ value: String(w.id), label: w.name })),
])
const resourceOptions = computed(() => [
  { value: '', label: 'Recurso…' },
  ...(resourceTypes.value ?? []).map((rt) => ({ value: String(rt.id), label: `${rt.name} (${rt.unit_of_measure})` })),
])

const resourceMap = computed(() => new Map((resourceTypes.value ?? []).map((rt) => [rt.id, rt])))
function itemWeight(it: ItemRow) {
  const rt = resourceMap.value.get(Number(it.resource_type_id))
  const q = Number(it.quantity)
  return rt && q > 0 ? rt.unit_weight_kg * q : 0
}
const totalWeight = computed(() => items.value.reduce((a, it) => a + itemWeight(it), 0))

const selectedWarehouse = computed(() =>
  form.value.destination_warehouse_id
    ? (warehouses.value ?? []).find((w) => w.id === Number(form.value.destination_warehouse_id))
    : undefined,
)
const remainingCapacity = computed(() =>
  selectedWarehouse.value ? selectedWarehouse.value.max_capacity_kg - selectedWarehouse.value.current_weight_kg : null,
)
// HU-19 CA3: alerta si el peso estimado excede la capacidad disponible.
const exceedsCapacity = computed(
  () => needsItems.value && remainingCapacity.value != null && totalWeight.value > remainingCapacity.value,
)

const kg = (n: number) => `${Math.round(n).toLocaleString('es-CO')} kg`

function addItem() {
  items.value.push({ resource_type_id: '', quantity: '', batch: '', expiration_date: '' })
}
function removeItem(i: number) {
  items.value.splice(i, 1)
}

function validateForm() {
  const e: Record<string, string> = {}
  if (!form.value.donor_id) e.donor_id = 'Selecciona el donante.'
  if (!form.value.date) e.date = 'Ingresa la fecha.'
  if (needsMoney.value) {
    const n = Number(form.value.monetary_amount)
    if (!form.value.monetary_amount || Number.isNaN(n) || n <= 0) e.monetary_amount = 'Ingresa un monto mayor que 0.'
  }
  if (needsItems.value) {
    if (!form.value.destination_warehouse_id) e.destination_warehouse_id = 'Selecciona la bodega destino.'
    if (!items.value.length) {
      e.details = 'Agrega al menos un ítem.'
    } else {
      const bad = items.value.some(
        (it) => !it.resource_type_id || !it.quantity || Number(it.quantity) <= 0 || !Number.isInteger(Number(it.quantity)),
      )
      if (bad) e.details = 'Cada ítem requiere un recurso y una cantidad entera mayor que 0.'
    }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

async function submit() {
  if (!validateForm()) return
  const payload: DonationPayload = {
    donor_id: Number(form.value.donor_id),
    donation_type: form.value.donation_type,
    date: form.value.date,
    notes: form.value.notes.trim() || null,
  }
  if (needsMoney.value) payload.monetary_amount = String(Number(form.value.monetary_amount))
  if (needsItems.value) {
    payload.destination_warehouse_id = Number(form.value.destination_warehouse_id)
    payload.details = items.value.map<DonationDetailInput>((it) => ({
      resource_type_id: Number(it.resource_type_id),
      quantity: Number(it.quantity),
      batch: it.batch.trim() || null,
      expiration_date: it.expiration_date || null,
    }))
  }
  try {
    const created = await create.mutateAsync(payload)
    toast.success(`Donación ${created.donation_code} registrada`)
    router.push('/donations')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo registrar. Verifica la capacidad de la bodega destino.'))
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-5">
    <PageHeader title="Registrar donación" crumb="Ayudas" subtitle="Donación en especie, monetaria o mixta">
      <template #actions>
        <AppButton variant="outline" @click="router.push('/donations')"><ArrowLeft /> Volver</AppButton>
      </template>
    </PageHeader>

    <form class="space-y-5" @submit.prevent="submit">
      <!-- Datos generales -->
      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Datos generales</legend>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField v-model="form.donor_id" label="Donante" required :options="donorOptions" :error="errors.donor_id" input-id="dn-donor" />
          <SelectField
            v-model="form.donation_type"
            label="Tipo de donación"
            required
            :options="DONATION_TYPE_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))"
            input-id="dn-type"
          />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Fecha" required :error="errors.date" input-id="dn-date">
            <input id="dn-date" v-model="form.date" type="date" :max="todayStr" class="control" />
          </FormField>
          <FormField label="Notas" :error="errors.notes" input-id="dn-notes" hint="Opcional">
            <input id="dn-notes" v-model="form.notes" class="control" placeholder="Observaciones…" />
          </FormField>
        </div>
      </fieldset>

      <!-- Monto monetario -->
      <fieldset v-if="needsMoney" class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Aporte monetario</legend>
        <FormField label="Monto (COP)" required :error="errors.monetary_amount" input-id="dn-amount">
          <input id="dn-amount" v-model="form.monetary_amount" type="number" min="1" step="any" class="control" placeholder="0" />
        </FormField>
      </fieldset>

      <!-- Ítems en especie -->
      <fieldset v-if="needsItems" class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Donación en especie</legend>

        <SelectField
          v-model="form.destination_warehouse_id"
          label="Bodega destino"
          required
          :options="warehouseOptions"
          :error="errors.destination_warehouse_id"
          input-id="dn-wh"
        />

        <div class="space-y-3">
          <div
            v-for="(it, i) in items"
            :key="i"
            class="grid grid-cols-1 gap-3 rounded-md border border-neutral-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
          >
            <SelectField v-model="it.resource_type_id" :options="resourceOptions" />
            <FormField label="" input-id="">
              <input v-model="it.quantity" type="number" min="1" class="control" placeholder="Cantidad" />
            </FormField>
            <FormField label="" input-id="">
              <input v-model="it.batch" class="control" placeholder="Lote (opc.)" />
            </FormField>
            <div class="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-center">
              <span class="font-mono text-xs text-neutral-500">{{ kg(itemWeight(it)) }}</span>
              <AppButton type="button" variant="ghost" size="sm" class="text-danger" :disabled="items.length === 1" @click="removeItem(i)">
                <Trash2 />
              </AppButton>
            </div>
            <FormField label="" input-id="" class="sm:col-span-4">
              <input v-model="it.expiration_date" type="date" class="control" placeholder="Vence (opc.)" />
            </FormField>
          </div>

          <p v-if="errors.details" class="text-sm text-danger">{{ errors.details }}</p>
          <AppButton type="button" variant="outline" size="sm" @click="addItem"><Plus /> Agregar ítem</AppButton>
        </div>

        <!-- Peso total + alerta de capacidad -->
        <div class="flex items-center justify-between rounded-md bg-neutral-50 p-3 text-sm">
          <span class="text-neutral-600">Peso estimado total</span>
          <span class="font-mono font-semibold text-neutral-900">{{ kg(totalWeight) }}</span>
        </div>
        <div v-if="selectedWarehouse" class="text-xs text-neutral-500">
          Capacidad disponible en {{ selectedWarehouse.name }}: {{ kg(remainingCapacity ?? 0) }}
        </div>
        <div v-if="exceedsCapacity" class="flex items-start gap-2 rounded-md border border-warning-br bg-warning-bg p-3 text-sm text-warning">
          <TriangleAlert class="mt-0.5 h-4 w-4 flex-none" />
          <span>El peso estimado supera la capacidad disponible de la bodega destino (HU-19). El registro podría ser rechazado.</span>
        </div>
      </fieldset>

      <div class="flex items-center justify-end gap-3 pb-4">
        <AppButton variant="ghost" type="button" @click="router.push('/donations')">Cancelar</AppButton>
        <AppButton type="submit" :disabled="saving"><Save /> {{ saving ? 'Registrando…' : 'Registrar donación' }}</AppButton>
      </div>
    </form>
  </section>
</template>
