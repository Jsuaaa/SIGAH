<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Save, Info, RotateCcw } from '@lucide/vue'
import { useScoringConfig, useScoringConfigMutations } from '@/composables/useScoringConfig'
import { SCORING_CONFIG_FIELDS } from '@/types/prioritization.types'
import type { ScoringConfigKey } from '@/types/prioritization.types'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/form/FormField.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const router = useRouter()
const { data: config, isLoading, isError, refetch } = useScoringConfig()
const { set } = useScoringConfigMutations()

const savedMap = computed(() => new Map((config.value ?? []).map((r) => [r.key, r.value])))
const draft = ref<Record<string, string>>({})
const saving = ref(false)

function inputVal(key: ScoringConfigKey) {
  return draft.value[key] ?? (savedMap.value.has(key) ? String(savedMap.value.get(key)) : '')
}
function onInput(key: ScoringConfigKey, v: string) {
  draft.value[key] = v
}
function fieldError(key: ScoringConfigKey) {
  const v = draft.value[key]
  if (v === undefined) return ''
  const n = Number(v)
  if (v === '' || Number.isNaN(n)) return 'Número inválido'
  if (n < 0) return 'No puede ser negativo'
  return ''
}
function isDirty(key: ScoringConfigKey) {
  const v = draft.value[key]
  if (v === undefined || fieldError(key)) return false
  return Number(v) !== savedMap.value.get(key)
}
const dirtyKeys = computed(() => SCORING_CONFIG_FIELDS.filter((f) => isDirty(f.key)).map((f) => f.key))
const hasErrors = computed(() => SCORING_CONFIG_FIELDS.some((f) => !!fieldError(f.key)))

async function saveAll() {
  if (!dirtyKeys.value.length || hasErrors.value) return
  saving.value = true
  try {
    for (const key of dirtyKeys.value) {
      await set.mutateAsync({ key, value: Number(draft.value[key]) })
    }
    toast.success('Pesos del puntaje actualizados')
    draft.value = {}
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    saving.value = false
  }
}
function resetChanges() {
  draft.value = {}
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-5">
    <PageHeader
      title="Pesos del puntaje"
      crumb="Configuración"
      subtitle="Ajusta cómo se prioriza a las familias (RN-04, HU-08 CA5)"
    />

    <div class="flex items-start gap-2 rounded-md bg-primary-50 p-3 text-sm text-primary-800">
      <Info class="mt-0.5 h-4 w-4 flex-none" />
      <span>
        Los nuevos pesos aplican a los próximos cálculos. Para reflejarlos en las familias existentes,
        usa
        <button class="font-semibold underline" @click="router.push('/deliveries/ranking')">Recalcular todos</button>
        en el ranking.
      </span>
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la configuración.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-5">
      <SkeletonBlock v-for="n in 9" :key="n" height="48px" />
    </div>

    <template v-else>
      <div class="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2">
        <FormField
          v-for="f in SCORING_CONFIG_FIELDS"
          :key="f.key"
          :label="f.label"
          :hint="f.description"
          :error="fieldError(f.key)"
          :input-id="`sc-${f.key}`"
        >
          <input
            :id="`sc-${f.key}`"
            type="number"
            step="any"
            min="0"
            class="control"
            :value="inputVal(f.key)"
            @input="onInput(f.key, ($event.target as HTMLInputElement).value)"
          />
        </FormField>
      </div>

      <div class="flex items-center justify-end gap-3">
        <span v-if="dirtyKeys.length" class="text-sm text-neutral-500">{{ dirtyKeys.length }} cambio(s) sin guardar</span>
        <AppButton variant="ghost" :disabled="!dirtyKeys.length || saving" @click="resetChanges">Descartar</AppButton>
        <AppButton :disabled="!dirtyKeys.length || hasErrors || saving" @click="saveAll">
          <Save /> {{ saving ? 'Guardando…' : 'Guardar cambios' }}
        </AppButton>
      </div>
    </template>
  </section>
</template>
