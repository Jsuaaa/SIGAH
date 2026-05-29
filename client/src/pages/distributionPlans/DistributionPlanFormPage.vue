<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, Save, Search, X } from '@lucide/vue'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import { useFamiliesList } from '@/composables/useFamilies'
import { usePlanMutations } from '@/composables/useDistributionPlans'
import { PLAN_SCOPE_OPTIONS } from '@/types/distributionPlan.types'
import type { CreatePlanPayload, DistributionPlanScope } from '@/types/distributionPlan.types'
import type { Family, FamilyListParams } from '@/types/family.types'
import { MIN_COVERAGE_DAYS } from '@/utils/constants'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'

const router = useRouter()
const { create } = usePlanMutations()
const saving = computed(() => create.isPending.value)

const scope = ref<DistributionPlanScope>('GLOBAL')
const scopeId = ref('')
const coverageDays = ref('7')
const notes = ref('')
const errors = ref<Record<string, string>>({})

const { data: zones } = useZones()
const { data: shelters } = useShelters()

const zoneOptions = computed(() => [{ value: '', label: 'Selecciona la zona…' }, ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name }))])
const shelterOptions = computed(() => [{ value: '', label: 'Selecciona el refugio…' }, ...(shelters.value ?? []).map((s) => ({ value: String(s.id), label: s.name }))])
const scopeOptions = PLAN_SCOPE_OPTIONS.map((o) => ({ value: o.value as string, label: o.label }))

// Selección de familias para scope LOTE.
const familyQuery = ref('')
const selectedFamilies = ref<Family[]>([])
const searchParams = computed<FamilyListParams>(() => ({
  page: 1,
  limit: 8,
  ...(familyQuery.value.trim().length >= 2 ? { q: familyQuery.value.trim() } : {}),
}))
const { data: familyResults } = useFamiliesList(searchParams)
const showResults = computed(() => scope.value === 'LOTE' && familyQuery.value.trim().length >= 2)
function addFamily(f: Family) {
  if (!selectedFamilies.value.some((x) => x.id === f.id)) selectedFamilies.value.push(f)
  familyQuery.value = ''
}
function removeFamily(id: number) {
  selectedFamilies.value = selectedFamilies.value.filter((f) => f.id !== id)
}

function validateForm() {
  const e: Record<string, string> = {}
  const cd = Number(coverageDays.value)
  if (!coverageDays.value || Number.isNaN(cd) || cd < MIN_COVERAGE_DAYS) e.coverage = `Mínimo ${MIN_COVERAGE_DAYS} días (RN-01).`
  if ((scope.value === 'ZONA' || scope.value === 'REFUGIO') && !scopeId.value) e.scope_id = 'Selecciona el destino.'
  if (scope.value === 'LOTE' && !selectedFamilies.value.length) e.families = 'Agrega al menos una familia.'
  errors.value = e
  return Object.keys(e).length === 0
}

async function submit() {
  if (!validateForm()) return
  const payload: CreatePlanPayload = {
    scope: scope.value,
    target_coverage_days: Number(coverageDays.value),
    notes: notes.value.trim() || null,
  }
  if (scope.value === 'ZONA' || scope.value === 'REFUGIO') payload.scope_id = Number(scopeId.value)
  if (scope.value === 'LOTE') payload.family_ids = selectedFamilies.value.map((f) => f.id)
  try {
    const plan = await create.mutateAsync(payload)
    toast.success(`Plan ${plan.plan_code} generado`)
    router.push(`/distribution-plans/${plan.id}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo generar el plan.'))
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl space-y-5">
    <PageHeader title="Nuevo plan de distribución" crumb="Ayudas" subtitle="Genera entregas priorizadas según el alcance (HU-21)">
      <template #actions>
        <AppButton variant="outline" @click="router.push('/distribution-plans')"><ArrowLeft /> Volver</AppButton>
      </template>
    </PageHeader>

    <form class="space-y-5" @submit.prevent="submit">
      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Alcance</legend>
        <SelectField v-model="scope" label="Tipo de plan" required :options="scopeOptions" input-id="pl-scope" />

        <SelectField v-if="scope === 'ZONA'" v-model="scopeId" label="Zona" required :options="zoneOptions" :error="errors.scope_id" input-id="pl-zone" />
        <SelectField v-else-if="scope === 'REFUGIO'" v-model="scopeId" label="Refugio" required :options="shelterOptions" :error="errors.scope_id" input-id="pl-shelter" />

        <div v-else-if="scope === 'LOTE'" class="space-y-2">
          <FormField label="Familias del lote" required :error="errors.families" input-id="pl-fam" hint="Busca y agrega familias (mín. 2 caracteres).">
            <div class="relative">
              <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input id="pl-fam" v-model="familyQuery" class="control pl-9" placeholder="Código / documento / dirección" />
            </div>
          </FormField>
          <ul v-if="showResults" class="max-h-48 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
            <li v-for="f in (familyResults?.data ?? [])" :key="f.id">
              <button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50" @click="addFamily(f)">
                <span class="font-semibold text-neutral-900">{{ f.family_code }}</span>
                <span class="text-xs text-neutral-500">{{ f.num_members }} miembros</span>
              </button>
            </li>
          </ul>
          <div v-if="selectedFamilies.length" class="flex flex-wrap gap-2">
            <span v-for="f in selectedFamilies" :key="f.id" class="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs text-primary-700">
              {{ f.family_code }}
              <button type="button" class="hover:text-danger" @click="removeFamily(f.id)"><X class="h-3 w-3" /></button>
            </span>
          </div>
        </div>
      </fieldset>

      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Parámetros</legend>
        <FormField label="Días de cobertura por familia" required :error="errors.coverage" input-id="pl-cov" :hint="`Mínimo ${MIN_COVERAGE_DAYS} días (RN-01).`">
          <input id="pl-cov" v-model="coverageDays" type="number" :min="MIN_COVERAGE_DAYS" class="control" />
        </FormField>
        <FormField label="Notas" input-id="pl-notes" hint="Opcional">
          <textarea id="pl-notes" v-model="notes" rows="2" class="control" placeholder="Observaciones del plan…" />
        </FormField>
      </fieldset>

      <div class="flex items-center justify-end gap-3 pb-4">
        <AppButton variant="ghost" type="button" @click="router.push('/distribution-plans')">Cancelar</AppButton>
        <AppButton type="submit" :disabled="saving"><Save /> {{ saving ? 'Generando…' : 'Generar plan' }}</AppButton>
      </div>
    </form>
  </section>
</template>
