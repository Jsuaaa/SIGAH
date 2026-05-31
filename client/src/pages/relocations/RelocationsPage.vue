<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  ArrowRightLeft, Plus, RotateCcw, ChevronLeft, ChevronRight, ArrowRight, Search,
} from '@lucide/vue'
import { useRelocations, useRelocationMutations } from '@/composables/useRelocations'
import { useFamiliesList } from '@/composables/useFamilies'
import { useShelters } from '@/composables/useShelters'
import {
  RELOCATION_TYPE_OPTIONS, RELOCATION_TYPE_LABELS,
} from '@/types/relocation.types'
import type {
  Relocation, RelocationListParams, RelocationPayload, RelocationType,
} from '@/types/relocation.types'
import type { Family, FamilyListParams } from '@/types/family.types'
import type { ShelterWithOccupancy } from '@/types/shelter.types'
import { relocationSchema } from '@/schemas/relocation.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import SearchInput from '@/components/form/SearchInput.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
// HU-24: aplicar traslados restringido a admin, censador y logística.
const EDIT_ROLES = ['ADMIN', 'CENSADOR', 'COORDINADOR_LOGISTICA'] as const

// --- Filtros + listado --------------------------------------------------------
const typeFilter = ref('')
const page = ref(1)

const params = computed<RelocationListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(typeFilter.value ? { type: typeFilter.value as RelocationType } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useRelocations(params)
// Catálogo de refugios (para destino y para mostrar el origen de la familia).
const { data: shelters } = useShelters()
const shelterMap = computed(
  () => new Map((shelters.value ?? []).map((s) => [s.id, s])),
)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!typeFilter.value)

const typeFilterOptions = [
  { value: '', label: 'Todos los tipos' },
  ...RELOCATION_TYPE_OPTIONS,
]

const columns = [
  { key: 'date', label: 'Fecha' },
  { key: 'family', label: 'Familia' },
  { key: 'route', label: 'Traslado' },
  { key: 'type', label: 'Tipo' },
  { key: 'reason', label: 'Motivo' },
]

const asRelocation = (r: unknown) => r as Relocation

function fmtDate(d: string) {
  const date = new Date(d)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })
}

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  typeFilter.value = ''
}

// --- Modal "Nuevo traslado" ---------------------------------------------------
const { apply } = useRelocationMutations()
const saving = computed(() => apply.isPending.value)

const modalOpen = ref(false)
const errors = ref<Record<string, string>>({})

// Selección de familia: buscamos por código/documento/dirección (RNF-04).
const familyQuery = ref('')
const selectedFamily = ref<Family | null>(null)
const familySearchParams = computed<FamilyListParams>(() => ({
  page: 1,
  limit: 8,
  ...(familyQuery.value ? { q: familyQuery.value } : {}),
}))
// La búsqueda solo se activa cuando hay texto y aún no se eligió familia.
const { data: familyResults, isFetching: familyLoading } = useFamiliesList(familySearchParams)
const familyOptions = computed(() => familyResults.value?.data ?? [])

// Refugio origen = refugio actual de la familia seleccionada (solo lectura).
const originShelter = computed<ShelterWithOccupancy | null>(() => {
  const f = selectedFamily.value
  if (!f || f.shelter_id == null) return null
  return shelterMap.value.get(f.shelter_id) ?? null
})

function blankForm() {
  return {
    destination_shelter_id: '',
    type: '' as RelocationType | '',
    reason: '',
    notes: '',
  }
}
const form = ref(blankForm())

// Cupo disponible del refugio (capacidad - ocupación), nunca negativo.
function availableSpots(s: ShelterWithOccupancy) {
  return Math.max(0, s.max_capacity - s.current_occupancy)
}

// Opciones de destino: todos los refugios EXCEPTO el origen, con cupo disponible.
const destinationOptions = computed(() => {
  const originId = originShelter.value?.id
  const opts = (shelters.value ?? [])
    .filter((s) => s.id !== originId)
    .map((s) => ({
      value: String(s.id),
      label: `${s.name} · cupo ${availableSpots(s)} de ${s.max_capacity}`,
    }))
  return [{ value: '', label: 'Selecciona el refugio destino…' }, ...opts]
})

// Cupo del destino elegido y miembros de la familia, para avisar antes de enviar.
const destinationShelter = computed<ShelterWithOccupancy | null>(() => {
  const id = Number(form.value.destination_shelter_id)
  return id ? shelterMap.value.get(id) ?? null : null
})
const destinationFits = computed(() => {
  const dest = destinationShelter.value
  const fam = selectedFamily.value
  if (!dest || !fam) return true
  return availableSpots(dest) >= fam.num_members
})

const typeFormOptions = [
  { value: '', label: 'Selecciona el tipo…' },
  ...RELOCATION_TYPE_OPTIONS,
]

function openCreate() {
  selectedFamily.value = null
  familyQuery.value = ''
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}

function pickFamily(f: Family) {
  selectedFamily.value = f
  // Al cambiar de familia el destino puede dejar de ser válido; lo reiniciamos.
  form.value.destination_shelter_id = ''
  delete errors.value.family_id
}
function clearFamily() {
  selectedFamily.value = null
  form.value.destination_shelter_id = ''
}

// Si se cierra el modal, soltamos la familia seleccionada.
watch(modalOpen, (open) => {
  if (!open) {
    selectedFamily.value = null
    familyQuery.value = ''
  }
})

async function submit() {
  const res = validate(relocationSchema, {
    family_id: selectedFamily.value?.id ?? '',
    destination_shelter_id: form.value.destination_shelter_id,
    type: form.value.type,
    reason: form.value.reason,
    notes: form.value.notes,
  })
  errors.value = res.ok ? {} : { ...res.errors }
  if (!res.ok) return

  const payload: RelocationPayload = {
    family_id: res.data.family_id,
    destination_shelter_id: res.data.destination_shelter_id,
    type: res.data.type,
    reason: res.data.reason,
    notes: res.data.notes ? res.data.notes : null,
  }
  try {
    await apply.mutateAsync(payload)
    toast.success('Traslado registrado')
    modalOpen.value = false
  } catch (e) {
    // HU-24 CA3: SH409 (HTTP 409) = el refugio destino no tiene capacidad.
    // Mostramos el cupo restante real frente a los miembros de la familia.
    if (apiErrorStatus(e) === 409) {
      const dest = destinationShelter.value
      const fam = selectedFamily.value
      const detail =
        dest && fam
          ? `El refugio destino no tiene capacidad: cupo restante ${availableSpots(dest)}, la familia tiene ${fam.num_members} ${fam.num_members === 1 ? 'miembro' : 'miembros'}.`
          : 'El refugio destino no tiene capacidad suficiente.'
      errors.value = { ...errors.value, destination_shelter_id: detail }
      toast.error(detail)
      return
    }
    // SH422 = la familia ya está en ese refugio (no debería ocurrir por el filtro).
    if (apiErrorStatus(e) === 422) {
      const msg = apiErrorMessage(e, 'La familia ya se encuentra en ese refugio.')
      errors.value = { ...errors.value, destination_shelter_id: msg }
      toast.error(msg)
      return
    }
    toast.error(apiErrorMessage(e))
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Traslados entre refugios"
      crumb="Operaciones"
      :subtitle="total ? `${total} ${total === 1 ? 'traslado registrado' : 'traslados registrados'}` : 'Reubicación de familias entre refugios'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Nuevo traslado</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los traslados.</p>
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
          <template #date="{ row }">
            <span class="text-neutral-700">{{ fmtDate(asRelocation(row).relocation_date) }}</span>
          </template>

          <template #family="{ row }">
            <div>
              <p class="font-semibold text-neutral-900">
                {{ asRelocation(row).family?.family_code ?? `Familia #${asRelocation(row).family_id}` }}
              </p>
              <p class="text-xs text-neutral-500">
                {{ asRelocation(row).family?.num_members ?? '—' }} miembros
              </p>
            </div>
          </template>

          <template #route="{ row }">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-neutral-500">
                {{ asRelocation(row).origin_shelter?.name
                  ?? shelterMap.get(asRelocation(row).origin_shelter_id ?? -1)?.name
                  ?? 'Sin refugio' }}
              </span>
              <ArrowRight class="h-4 w-4 flex-none text-neutral-400" />
              <span class="font-medium text-neutral-800">
                {{ asRelocation(row).destination_shelter?.name
                  ?? shelterMap.get(asRelocation(row).destination_shelter_id)?.name
                  ?? `#${asRelocation(row).destination_shelter_id}` }}
              </span>
            </div>
          </template>

          <template #type="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                asRelocation(row).type === 'PERMANENT'
                  ? 'text-primary-700 bg-info-bg border-info-br'
                  : 'text-neutral-700 bg-neutral-100 border-neutral-200',
              ]"
            >
              {{ RELOCATION_TYPE_LABELS[asRelocation(row).type] }}
            </span>
          </template>

          <template #reason="{ row }">
            <span class="block max-w-[280px] truncate text-neutral-600" :title="asRelocation(row).reason">
              {{ asRelocation(row).reason }}
            </span>
          </template>

          <template #empty>
            <EmptyState
              title="Sin traslados"
              :message="hasFilters ? 'No hay traslados que coincidan con los filtros.' : 'Aún no se han registrado traslados entre refugios.'"
            >
              <template #icon><ArrowRightLeft /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Nuevo traslado</AppButton>
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

    <!-- Modal: nuevo traslado -->
    <BaseModal
      :open="modalOpen"
      title="Nuevo traslado"
      max-width="max-w-[620px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <!-- Paso 1: elegir familia -->
        <FormField
          label="Familia a trasladar"
          required
          :error="errors.family_id"
          :hint="!selectedFamily ? 'Busca por código, documento o dirección y selecciona la familia.' : undefined"
        >
          <div v-if="selectedFamily" class="flex items-center justify-between gap-3 rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3">
            <div>
              <p class="font-semibold text-neutral-900">{{ selectedFamily.family_code }}</p>
              <p class="text-xs text-neutral-500">
                Doc. {{ selectedFamily.head_document }} · {{ selectedFamily.num_members }}
                {{ selectedFamily.num_members === 1 ? 'miembro' : 'miembros' }}
              </p>
            </div>
            <AppButton variant="ghost" size="sm" @click="clearFamily">Cambiar</AppButton>
          </div>

          <div v-else class="space-y-2">
            <SearchInput v-model="familyQuery" placeholder="Código, documento o dirección…" />
            <div v-if="familyQuery" class="max-h-52 overflow-y-auto rounded-md border border-neutral-200">
              <p v-if="familyLoading" class="px-3 py-3 text-sm text-neutral-500">Buscando…</p>
              <p v-else-if="!familyOptions.length" class="px-3 py-3 text-sm text-neutral-500">
                No se encontraron familias.
              </p>
              <button
                v-for="f in familyOptions"
                v-else
                :key="f.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-primary-50"
                @click="pickFamily(f)"
              >
                <span>
                  <span class="font-semibold text-neutral-900">{{ f.family_code }}</span>
                  <span class="text-neutral-500"> · Doc. {{ f.head_document }}</span>
                </span>
                <span class="text-xs text-neutral-500">{{ f.num_members }} miemb.</span>
              </button>
            </div>
            <p v-else class="flex items-center gap-1.5 px-1 text-xs text-neutral-400">
              <Search class="h-3.5 w-3.5" /> Escribe para buscar la familia.
            </p>
          </div>
        </FormField>

        <!-- Origen (solo lectura) -->
        <FormField label="Refugio origen" hint="Refugio actual de la familia (no editable).">
          <div class="flex min-h-11 items-center rounded-md border border-neutral-200 bg-neutral-100 px-4 text-sm text-neutral-600">
            <template v-if="!selectedFamily">Selecciona primero una familia.</template>
            <template v-else-if="originShelter">
              {{ originShelter.name }}
              <span class="ml-2 text-xs text-neutral-400">
                (ocupación {{ originShelter.current_occupancy }}/{{ originShelter.max_capacity }})
              </span>
            </template>
            <template v-else>La familia no está asignada a ningún refugio.</template>
          </div>
        </FormField>

        <!-- Destino -->
        <SelectField
          v-model="form.destination_shelter_id"
          label="Refugio destino"
          required
          :options="destinationOptions"
          :error="errors.destination_shelter_id"
          :disabled="!selectedFamily"
          input-id="rel-dest"
          hint="Excluye el refugio origen. Se muestra el cupo disponible de cada refugio."
        />
        <!-- Aviso de cupo antes de enviar (CA3). -->
        <p
          v-if="destinationShelter && selectedFamily && !destinationFits"
          class="-mt-2 flex items-center gap-1.5 text-sm text-warning"
        >
          Atención: el cupo restante ({{ availableSpots(destinationShelter) }}) es menor que los
          miembros de la familia ({{ selectedFamily.num_members }}).
        </p>

        <SelectField
          v-model="form.type"
          label="Tipo de traslado"
          required
          :options="typeFormOptions"
          :error="errors.type"
          input-id="rel-type"
        />

        <FormField label="Motivo" required :error="errors.reason" input-id="rel-reason">
          <textarea
            id="rel-reason"
            v-model="form.reason"
            class="control"
            rows="3"
            placeholder="Describe el motivo del traslado (mínimo 5 caracteres)."
          />
        </FormField>

        <FormField label="Notas" :error="errors.notes" input-id="rel-notes" hint="Opcional.">
          <textarea
            id="rel-notes"
            v-model="form.notes"
            class="control"
            rows="2"
            placeholder="Información adicional."
          />
        </FormField>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Registrando…' : 'Registrar traslado' }}
        </AppButton>
      </template>
    </BaseModal>
  </section>
</template>
