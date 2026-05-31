<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ChevronLeft, ChevronRight, AlertTriangle, Check } from '@lucide/vue'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import { useDistributionPlanMutations } from '@/composables/useDistributionPlans'
import { useFamiliesList } from '@/composables/useFamilies'
import {
  DISTRIBUTION_PLAN_SCOPE_OPTIONS,
  DISTRIBUTION_PLAN_SCOPE_LABELS,
} from '@/types/distributionPlan.types'
import type { DistributionPlanPayload, DistributionPlanScope } from '@/types/distributionPlan.types'
import type { Family, FamilyListParams } from '@/types/family.types'
import { distributionPlanCreateSchema } from '@/schemas/distributionPlan.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import StepperNav from '@/components/ui/StepperNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'

const router = useRouter()

const STEPS = ['Alcance', 'Familias elegibles', 'Confirmar']
const current = ref(0)

// Estado local del wizard: NO se persiste nada hasta el paso 3 (Confirmar).
const form = reactive({
  scope: 'GLOBAL' as DistributionPlanScope,
  scope_id: '' as string | number,
  target_coverage_days: '7' as string | number,
  notes: '',
})
const selectedFamilyIds = ref<number[]>([])
const errors = reactive<Record<string, string>>({})

function resetErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
}

// --- Catálogos para los selects de alcance -----------------------------------
const zonesQuery = useZones()
const sheltersQuery = useShelters()

const zoneOptions = computed(() => [
  { value: '', label: 'Selecciona una zona' },
  ...(zonesQuery.data.value ?? []).map((z) => ({ value: z.id, label: z.name })),
])
const shelterOptions = computed(() => [
  { value: '', label: 'Selecciona un refugio' },
  ...(sheltersQuery.data.value ?? []).map((s) => ({ value: s.id, label: s.name })),
])

const scopeOptions = DISTRIBUTION_PLAN_SCOPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
const scopeHint = computed(
  () => DISTRIBUTION_PLAN_SCOPE_OPTIONS.find((o) => o.value === form.scope)?.hint ?? '',
)

const needsZone = computed(() => form.scope === 'ZONA')
const needsShelter = computed(() => form.scope === 'REFUGIO')
const isBatch = computed(() => form.scope === 'LOTE')

// Al cambiar de alcance se limpia el id y la selección de lote (estado coherente).
watch(
  () => form.scope,
  () => {
    form.scope_id = ''
    selectedFamilyIds.value = []
    resetErrors()
  },
)

// --- Vista previa de familias elegibles (paso 2) ------------------------------
// El backend no expone un endpoint de "preview": el plan se genera al confirmar.
// Para mostrar las familias candidatas ordenadas por puntaje reutilizamos el
// listado /families (order_by=priority_score_desc) filtrado por el alcance. Es una
// aproximación de las familias que el plan considerará; la elegibilidad final
// (stock/cobertura) la decide el backend al generar el plan.
const PREVIEW_LIMIT = 50
const previewParams = computed<FamilyListParams>(() => ({
  page: 1,
  limit: PREVIEW_LIMIT,
  order_by: 'priority_score_desc',
  ...(needsZone.value && form.scope_id ? { zone_id: Number(form.scope_id) } : {}),
  ...(needsShelter.value && form.scope_id ? { shelter_id: Number(form.scope_id) } : {}),
}))

// Solo consultamos cuando estamos en el paso 2/3 y el alcance está bien definido.
const previewEnabled = computed(() => {
  if (current.value < 1) return false
  if (needsZone.value || needsShelter.value) return !!form.scope_id
  return true
})

const {
  data: previewData,
  isLoading: previewLoading,
  isFetching: previewFetching,
  isError: previewError,
} = useFamiliesList(previewParams)

const previewFamilies = computed<Family[]>(() =>
  previewEnabled.value ? (previewData.value?.data ?? []) : [],
)
const previewTotal = computed(() => previewData.value?.pagination.total ?? 0)

// En LOTE el usuario elige manualmente; mostramos las candidatas con checkbox.
const isSelected = (id: number) => selectedFamilyIds.value.includes(id)
function toggleFamily(id: number) {
  selectedFamilyIds.value = isSelected(id)
    ? selectedFamilyIds.value.filter((x) => x !== id)
    : [...selectedFamilyIds.value, id]
}

const familyColumns = computed(() => [
  ...(isBatch.value ? [{ key: 'select', label: '', align: 'center' as const }] : []),
  { key: 'family_code', label: 'Código' },
  { key: 'zone_id', label: 'Zona', align: 'center' as const },
  { key: 'num_members', label: 'Integrantes', align: 'center' as const },
  { key: 'priority_score', label: 'Puntaje', align: 'center' as const },
])
const asFamily = (r: unknown) => r as Family
const zoneName = (id: number) => (zonesQuery.data.value ?? []).find((z) => z.id === id)?.name ?? '—'

// Familias consideradas en el resumen del paso 3.
const consideredCount = computed(() =>
  isBatch.value ? selectedFamilyIds.value.length : previewTotal.value,
)

// --- Navegación entre pasos ---------------------------------------------------
function validateScopeStep(): boolean {
  resetErrors()
  const days = Number(form.target_coverage_days)
  if (!Number.isInteger(days) || days < 3) {
    errors.target_coverage_days = 'La cobertura objetivo debe ser de al menos 3 días (RN-01).'
  }
  if ((needsZone.value || needsShelter.value) && !form.scope_id) {
    errors.scope_id = needsZone.value ? 'Selecciona la zona del plan.' : 'Selecciona el refugio del plan.'
  }
  return Object.keys(errors).length === 0
}

function next() {
  if (current.value === 0 && !validateScopeStep()) return
  if (current.value === 1 && isBatch.value && selectedFamilyIds.value.length === 0) {
    toast.error('Selecciona al menos una familia para el lote.')
    return
  }
  current.value = Math.min(current.value + 1, STEPS.length - 1)
}
function prev() {
  current.value = Math.max(current.value - 1, 0)
}

// --- Confirmar (única persistencia) ------------------------------------------
const { create } = useDistributionPlanMutations()
const saving = computed(() => create.isPending.value)

function buildPayload(): DistributionPlanPayload | null {
  const result = validate(distributionPlanCreateSchema, {
    scope: form.scope,
    target_coverage_days: form.target_coverage_days,
    scope_id: form.scope === 'ZONA' || form.scope === 'REFUGIO' ? form.scope_id || undefined : undefined,
    family_ids: form.scope === 'LOTE' ? selectedFamilyIds.value : undefined,
    notes: form.notes || undefined,
  })
  if (!result.ok) {
    Object.assign(errors, result.errors)
    return null
  }
  const data = result.data
  const payload: DistributionPlanPayload = {
    scope: data.scope,
    target_coverage_days: data.target_coverage_days,
  }
  if (data.scope === 'ZONA' || data.scope === 'REFUGIO') payload.scope_id = data.scope_id ?? null
  if (data.scope === 'LOTE') payload.family_ids = data.family_ids ?? []
  if (data.notes) payload.notes = data.notes
  return payload
}

async function submit() {
  resetErrors()
  const payload = buildPayload()
  if (!payload) {
    // Si la validación falla por el alcance, vuelve al primer paso para corregir.
    if (errors.scope_id || errors.target_coverage_days) current.value = 0
    else if (errors.family_ids) current.value = 1
    return
  }
  try {
    const plan = await create.mutateAsync(payload)
    toast.success(`Plan ${plan.plan_code} generado.`)
    router.push(`/distribution-plans/${plan.id}`)
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

function goBack() {
  router.push('/distribution-plans')
}
</script>

<template>
  <section class="space-y-6">
    <PageHeader title="Nuevo plan de distribución" crumb="Logística" subtitle="Generación priorizada de entregas">
      <template #actions>
        <AppButton variant="ghost" @click="goBack">Volver</AppButton>
      </template>
    </PageHeader>

    <div class="mx-auto max-w-[760px] px-2">
      <StepperNav :steps="STEPS" :current="current" />
    </div>

    <div class="mx-auto max-w-[760px] space-y-5 rounded-lg border border-neutral-200 bg-white p-6">
      <!-- Paso 1: Alcance -->
      <template v-if="current === 0">
        <h4 class="text-lg font-semibold text-neutral-900">Define el alcance del plan</h4>

        <SelectField
          v-model="form.scope"
          label="Alcance"
          required
          :options="scopeOptions"
          :hint="scopeHint"
          input-id="dp-scope"
        />

        <SelectField
          v-if="needsZone"
          v-model="form.scope_id"
          label="Zona"
          required
          :options="zoneOptions"
          :error="errors.scope_id"
          :disabled="zonesQuery.isLoading.value"
          input-id="dp-zone"
        />
        <SelectField
          v-else-if="needsShelter"
          v-model="form.scope_id"
          label="Refugio"
          required
          :options="shelterOptions"
          :error="errors.scope_id"
          :disabled="sheltersQuery.isLoading.value"
          input-id="dp-shelter"
        />

        <FormField
          label="Cobertura objetivo (días)"
          required
          :error="errors.target_coverage_days"
          input-id="dp-days"
          hint="Días de alimentación que debe cubrir cada entrega. Mínimo 3 (RN-01)."
        >
          <input
            id="dp-days"
            v-model="form.target_coverage_days"
            type="number"
            min="3"
            step="1"
            class="control"
            placeholder="7"
          />
        </FormField>

        <FormField label="Notas" :error="errors.notes" input-id="dp-notes" hint="Opcional.">
          <textarea
            id="dp-notes"
            v-model="form.notes"
            rows="2"
            class="control"
            placeholder="Observaciones del plan…"
          />
        </FormField>
      </template>

      <!-- Paso 2: Familias elegibles (preview) -->
      <template v-else-if="current === 1">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="text-lg font-semibold text-neutral-900">Familias elegibles</h4>
            <p class="mt-1 text-sm text-neutral-500">
              {{ isBatch
                ? 'Selecciona las familias que conformarán el lote (ordenadas por puntaje de prioridad).'
                : `Familias candidatas para el alcance ${DISTRIBUTION_PLAN_SCOPE_LABELS[form.scope]}, ordenadas por puntaje de prioridad.` }}
            </p>
          </div>
        </div>

        <div v-if="previewError" class="rounded-lg border border-danger-br bg-danger-bg p-4 text-sm text-danger">
          No se pudieron cargar las familias elegibles.
        </div>

        <div v-else-if="previewLoading" class="space-y-2">
          <SkeletonBlock v-for="n in 6" :key="n" height="40px" />
        </div>

        <template v-else>
          <p v-if="!isBatch" class="text-sm text-neutral-600">
            <strong>{{ previewTotal }}</strong>
            {{ previewTotal === 1 ? 'familia candidata' : 'familias candidatas' }}.
            <span v-if="previewTotal > previewFamilies.length" class="text-neutral-400">
              (mostrando las {{ previewFamilies.length }} de mayor puntaje)
            </span>
          </p>
          <p v-else class="text-sm text-neutral-600">
            <strong>{{ selectedFamilyIds.length }}</strong> seleccionada(s) de {{ previewFamilies.length }} mostradas.
          </p>

          <div :class="{ 'opacity-60 transition-opacity': previewFetching }">
            <DataTable :columns="familyColumns" :rows="previewFamilies" row-key="id" min-width="640px">
              <template #select="{ row }">
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-primary-600"
                  :checked="isSelected(asFamily(row).id)"
                  @change="toggleFamily(asFamily(row).id)"
                />
              </template>
              <template #family_code="{ row }">
                <span class="font-mono text-xs">{{ asFamily(row).family_code }}</span>
              </template>
              <template #zone_id="{ row }">
                {{ zoneName(asFamily(row).zone_id) }}
              </template>
              <template #priority_score="{ row }">
                <span class="font-semibold text-primary-700">{{ asFamily(row).priority_score }}</span>
              </template>
              <template #empty>
                <EmptyState
                  title="Sin familias elegibles"
                  message="No hay familias que coincidan con el alcance seleccionado."
                />
              </template>
            </DataTable>
          </div>

          <p class="text-xs text-neutral-400">
            La elegibilidad final (cobertura ya cubierta y stock disponible) la determina el sistema
            al generar el plan. Las familias sin stock suficiente quedarán marcadas como “sin atender”.
          </p>
        </template>
      </template>

      <!-- Paso 3: Confirmar -->
      <template v-else>
        <h4 class="text-lg font-semibold text-neutral-900">Confirmar y generar</h4>

        <dl class="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          <div class="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt class="text-neutral-500">Alcance</dt>
            <dd class="font-medium text-neutral-800">{{ DISTRIBUTION_PLAN_SCOPE_LABELS[form.scope] }}</dd>
          </div>
          <div v-if="needsZone" class="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt class="text-neutral-500">Zona</dt>
            <dd class="font-medium text-neutral-800">{{ zoneName(Number(form.scope_id)) }}</dd>
          </div>
          <div v-else-if="needsShelter" class="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt class="text-neutral-500">Refugio</dt>
            <dd class="font-medium text-neutral-800">
              {{ (sheltersQuery.data.value ?? []).find((s) => s.id === Number(form.scope_id))?.name ?? '—' }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt class="text-neutral-500">Cobertura objetivo</dt>
            <dd class="font-medium text-neutral-800">{{ form.target_coverage_days }} días</dd>
          </div>
          <div class="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt class="text-neutral-500">Familias consideradas</dt>
            <dd class="font-medium text-neutral-800">{{ consideredCount }}</dd>
          </div>
          <div v-if="form.notes" class="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt class="text-neutral-500">Notas</dt>
            <dd class="max-w-[60%] text-right font-medium text-neutral-800">{{ form.notes }}</dd>
          </div>
        </dl>

        <div class="flex items-start gap-3 rounded-lg border border-info-br bg-info-bg p-4">
          <Check class="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
          <p class="text-sm text-neutral-700">
            Al confirmar, el sistema priorizará las familias por puntaje y creará una entrega pendiente
            por cada una con stock suficiente. Las familias sin stock quedarán
            <strong>sin atender</strong> y podrás revisarlas en el detalle del plan.
          </p>
        </div>
      </template>

      <!-- Navegación del wizard -->
      <div class="flex items-center justify-between border-t border-neutral-100 pt-4">
        <AppButton v-if="current > 0" variant="ghost" @click="prev">
          <ChevronLeft /> Atrás
        </AppButton>
        <span v-else />

        <AppButton v-if="current < STEPS.length - 1" @click="next">
          Siguiente <ChevronRight />
        </AppButton>
        <AppButton v-else :disabled="saving" @click="submit">
          {{ saving ? 'Generando…' : 'Generar plan' }}
        </AppButton>
      </div>
    </div>

    <!-- Aviso si el alcance requiere selección y falta (banner de ayuda en paso 2) -->
    <div
      v-if="current === 1 && (needsZone || needsShelter) && !form.scope_id"
      class="mx-auto flex max-w-[760px] items-start gap-3 rounded-lg border border-warning-br bg-warning-bg p-4"
    >
      <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <p class="text-sm text-warning">Vuelve al paso anterior y selecciona la zona o el refugio del plan.</p>
    </div>
  </section>
</template>
