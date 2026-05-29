<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Plus, Search, MoveRight, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useRelocationsList, useRelocationMutations } from '@/composables/useRelocations'
import { useFamiliesList } from '@/composables/useFamilies'
import { useShelters } from '@/composables/useShelters'
import { RELOCATION_TYPE_OPTIONS, RELOCATION_TYPE_LABELS } from '@/types/relocation.types'
import type { RelocationEnriched, RelocationListParams, RelocationPayload, RelocationType } from '@/types/relocation.types'
import type { Family, FamilyListParams } from '@/types/family.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const typeFilter = ref('')
const page = ref(1)
watch(typeFilter, () => { page.value = 1 })

const params = computed<RelocationListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(typeFilter.value ? { type: typeFilter.value as RelocationType } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useRelocationsList(params)
const { data: shelters } = useShelters()
const { create } = useRelocationMutations()

const shelterMap = computed(() => new Map((shelters.value ?? []).map((s) => [s.id, s])))
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const hasFilters = computed(() => !!typeFilter.value)

const typeFilterOptions = [{ value: '', label: 'Todos los tipos' }, ...RELOCATION_TYPE_OPTIONS]
const typeFormOptions = [{ value: '', label: 'Selecciona…' }, ...RELOCATION_TYPE_OPTIONS]
const shelterFormOptions = computed(() => [{ value: '', label: 'Selecciona el refugio…' }, ...(shelters.value ?? []).map((s) => ({ value: String(s.id), label: s.name }))])

const columns = [
  { key: 'family', label: 'Familia' },
  { key: 'route', label: 'Origen → Destino' },
  { key: 'type', label: 'Tipo' },
  { key: 'relocation_date', label: 'Fecha' },
  { key: 'authorized_by', label: 'Autorizado por' },
]
const asReloc = (r: unknown) => r as RelocationEnriched

function shelterName(id: number | null | undefined) {
  if (id == null) return '—'
  return shelterMap.value.get(id)?.name ?? `#${id}`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function goTo(p: number) { page.value = Math.min(Math.max(1, p), totalPages.value) }

// --- Modal nuevo traslado -----------------------------------------------------
const modalOpen = ref(false)
const saving = computed(() => create.isPending.value)
const errors = ref<Record<string, string>>({})
const familyQuery = ref('')
const selectedFamily = ref<Family | null>(null)
const destinationId = ref('')
const relocType = ref('')
const reason = ref('')
const notes = ref('')

const searchParams = computed<FamilyListParams>(() => ({
  page: 1, limit: 8,
  ...(familyQuery.value.trim().length >= 2 ? { q: familyQuery.value.trim() } : {}),
}))
const { data: familyResults } = useFamiliesList(searchParams)
const showResults = computed(() => familyQuery.value.trim().length >= 2 && !selectedFamily.value)
// Refugios destino: excluir el refugio actual de la familia (HU-24).
const destinationOptions = computed(() =>
  shelterFormOptions.value.filter((o) => !o.value || Number(o.value) !== selectedFamily.value?.shelter_id),
)

function openCreate() {
  selectedFamily.value = null
  familyQuery.value = ''
  destinationId.value = ''
  relocType.value = ''
  reason.value = ''
  notes.value = ''
  errors.value = {}
  modalOpen.value = true
}
function pickFamily(f: Family) {
  selectedFamily.value = f
  familyQuery.value = ''
}
async function submit() {
  const e: Record<string, string> = {}
  if (!selectedFamily.value) e.family = 'Selecciona una familia.'
  if (!destinationId.value) e.destination = 'Selecciona el refugio destino.'
  if (!relocType.value) e.type = 'Selecciona el tipo.'
  if (reason.value.trim().length < 5) e.reason = 'El motivo es obligatorio (mín. 5 caracteres).'
  errors.value = e
  if (Object.keys(e).length || !selectedFamily.value) return

  const payload: RelocationPayload = {
    family_id: selectedFamily.value.id,
    destination_shelter_id: Number(destinationId.value),
    type: relocType.value as RelocationType,
    reason: reason.value.trim(),
    notes: notes.value.trim() || null,
  }
  try {
    await create.mutateAsync(payload)
    toast.success('Traslado registrado')
    modalOpen.value = false
  } catch (err) {
    toast.error(apiErrorMessage(err, 'No se pudo registrar: verifica la capacidad del refugio destino (HU-24).'))
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Traslados"
      crumb="Operaciones"
      :subtitle="total ? `${total} ${total === 1 ? 'traslado' : 'traslados'}` : 'Reubicación de familias entre refugios (HU-24)'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]"><AppButton @click="openCreate"><Plus /> Nuevo traslado</AppButton></RoleGate>
      </template>
    </PageHeader>

    <div class="rounded-lg border border-neutral-200 bg-white p-4 sm:max-w-xs">
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los traslados.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="820px">
          <template #family="{ row }">
            <span class="font-semibold text-neutral-900">{{ asReloc(row).family?.family_code ?? `#${asReloc(row).family_id}` }}</span>
          </template>
          <template #route="{ row }">
            <span class="flex items-center gap-2 text-sm">
              {{ asReloc(row).origin_shelter?.name ?? shelterName(asReloc(row).origin_shelter_id) }}
              <MoveRight class="h-4 w-4 text-neutral-400" />
              <span class="font-medium text-neutral-900">{{ asReloc(row).destination_shelter?.name ?? shelterName(asReloc(row).destination_shelter_id) }}</span>
            </span>
          </template>
          <template #type="{ row }">{{ RELOCATION_TYPE_LABELS[asReloc(row).type] }}</template>
          <template #relocation_date="{ row }">{{ fmtDate(asReloc(row).relocation_date) }}</template>
          <template #authorized_by="{ row }"><span class="text-sm text-neutral-600">{{ asReloc(row).authorized_by_user?.name ?? '—' }}</span></template>
          <template #empty>
            <EmptyState title="Sin traslados" :message="hasFilters ? 'No hay traslados de ese tipo.' : 'Aún no se han registrado traslados.'">
              <template #icon><MoveRight /></template>
              <template #action>
                <RoleGate :roles="[...EDIT_ROLES]"><AppButton size="sm" @click="openCreate"><Plus /> Nuevo traslado</AppButton></RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>{{ total }} en total</span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>

    <!-- Modal nuevo traslado -->
    <BaseModal :open="modalOpen" title="Nuevo traslado" max-width="max-w-[560px]" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="submit">
        <div v-if="!selectedFamily">
          <FormField label="Familia" required :error="errors.family" input-id="rl-fam" hint="Busca por código, documento o dirección.">
            <div class="relative">
              <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input id="rl-fam" v-model="familyQuery" class="control pl-9" placeholder="FAM-… / documento" />
            </div>
          </FormField>
          <ul v-if="showResults" class="mt-2 max-h-48 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            <li v-for="f in (familyResults?.data ?? [])" :key="f.id">
              <button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50" @click="pickFamily(f)">
                <span class="font-semibold text-neutral-900">{{ f.family_code }}</span>
                <span class="text-xs text-neutral-500">{{ f.shelter_id ? shelterName(f.shelter_id) : 'sin refugio' }}</span>
              </button>
            </li>
          </ul>
        </div>
        <div v-else class="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <span><span class="font-semibold text-neutral-900">{{ selectedFamily.family_code }}</span> · actual: {{ shelterName(selectedFamily.shelter_id) }}</span>
          <AppButton type="button" variant="ghost" size="sm" @click="selectedFamily = null">Cambiar</AppButton>
        </div>

        <SelectField v-model="destinationId" label="Refugio destino" required :options="destinationOptions" :error="errors.destination" input-id="rl-dest" />
        <SelectField v-model="relocType" label="Tipo de traslado" required :options="typeFormOptions" :error="errors.type" input-id="rl-type" />
        <FormField label="Motivo" required :error="errors.reason" input-id="rl-reason">
          <textarea id="rl-reason" v-model="reason" rows="2" class="control" placeholder="Motivo del traslado…" />
        </FormField>
        <FormField label="Notas" input-id="rl-notes" hint="Opcional">
          <input id="rl-notes" v-model="notes" class="control" placeholder="Observaciones…" />
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">{{ saving ? 'Registrando…' : 'Registrar traslado' }}</AppButton>
      </template>
    </BaseModal>
  </section>
</template>
