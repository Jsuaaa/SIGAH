<template>
  <section class="page">
    <PageHeader
      title="Configuración de pesos de puntaje"
      subtitle="Algoritmo de priorización de familias"
    />

    <!-- Carga -->
    <div v-if="query.isLoading.value" class="form">
      <SkeletonBlock v-for="n in SCORING_CONFIG_KEYS.length" :key="n" height="3.5rem" />
    </div>

    <!-- Error -->
    <div v-else-if="query.isError.value" class="state state--error">
      No se pudo cargar la configuración de pesos.
      <AppButton variant="ghost" @click="query.refetch()">Reintentar</AppButton>
    </div>

    <template v-else>
      <p class="intro">
        Estos pesos definen cómo se calcula el puntaje de prioridad de cada familia. Al
        guardar, los puntajes y rankings se recalculan con los nuevos valores.
      </p>

      <form class="form" @submit.prevent="submit">
        <FormField
          v-for="key in SCORING_CONFIG_KEYS"
          :key="key"
          :label="SCORING_CONFIG_LABELS[key].label"
          :error="errors[key]"
          :hint="hintFor(key)"
          required
        >
          <input
            v-model="form[key]"
            class="control"
            type="number"
            :step="SCORING_CONFIG_LABELS[key].integer ? '1' : 'any'"
            :min="SCORING_CONFIG_LABELS[key].integer ? '1' : '0'"
            :disabled="!canEdit || mutations.update.isPending.value"
          />
        </FormField>

        <div v-if="canEdit" class="actions">
          <AppButton type="button" variant="ghost" :disabled="mutations.update.isPending.value" @click="reset">
            Restablecer
          </AppButton>
          <AppButton type="submit" :disabled="mutations.update.isPending.value">
            {{ mutations.update.isPending.value ? 'Guardando…' : 'Guardar cambios' }}
          </AppButton>
        </div>
        <p v-else class="state state--warning">
          No tienes permisos para editar los pesos de puntaje.
        </p>
      </form>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useScoringConfig, useScoringConfigMutations } from '@/composables/useScoringConfig'
import { useAuthStore } from '@/stores/auth'
import { scoringConfigSchema } from '@/schemas/scoringConfig.schema'
import {
  SCORING_CONFIG_KEYS,
  SCORING_CONFIG_LABELS,
  SCORING_CONFIG_DEFAULTS,
  type ScoringConfigKey,
} from '@/types/scoringConfig.types'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import { toast } from 'vue-sonner'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FormField from '@/components/form/FormField.vue'

const query = useScoringConfig()
const mutations = useScoringConfigMutations()
const auth = useAuthStore()

// Edición solo para ADMIN / COORDINADOR_LOGISTICA (mismo contrato que el backend).
const canEdit = computed(() => auth.hasRole('ADMIN', 'COORDINADOR_LOGISTICA'))

// Formulario: un campo string por peso (los inputs number entregan strings).
type FormState = Record<ScoringConfigKey, string | number>
const emptyForm = () =>
  Object.fromEntries(SCORING_CONFIG_KEYS.map((k) => [k, ''])) as FormState

const form = reactive<FormState>(emptyForm())
const errors = reactive<Record<string, string>>({})

// Valor cargado desde el backend, para detectar qué pesos cambiaron al guardar.
const loaded = reactive<Partial<Record<ScoringConfigKey, number>>>({})

function resetErrors() {
  Object.keys(errors).forEach((k) => delete errors[k])
}

// Vuelca las filas del backend en el formulario.
function hydrate() {
  const rows = query.data.value ?? []
  for (const row of rows) {
    form[row.key] = String(row.value)
    loaded[row.key] = Number(row.value)
  }
}

watch(query.data, hydrate, { immediate: true })

function reset() {
  resetErrors()
  hydrate()
}

// Sugerencia por campo: ayuda + valor por defecto del seed como referencia.
function hintFor(key: ScoringConfigKey): string {
  return `${SCORING_CONFIG_LABELS[key].hint} (por defecto: ${SCORING_CONFIG_DEFAULTS[key]})`
}

async function submit() {
  if (!canEdit.value) return
  resetErrors()

  const result = validate(
    scoringConfigSchema,
    Object.fromEntries(SCORING_CONFIG_KEYS.map((k) => [k, form[k]])),
  )

  if (!result.ok) {
    Object.assign(errors, result.errors)
    return
  }

  // El backend edita un peso por petición; enviamos solo los que cambiaron.
  const changed = SCORING_CONFIG_KEYS.filter((k) => result.data[k] !== loaded[k])

  if (changed.length === 0) {
    toast.info('No hay cambios para guardar.')
    return
  }

  try {
    for (const key of changed) {
      await mutations.update.mutateAsync({ key, value: result.data[key] })
    }
    toast.success('Pesos de puntaje actualizados. Los puntajes se recalcularán.')
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 560px;
}

.intro {
  max-width: 560px;
  color: #4b5563;
  margin-bottom: 1rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.state {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
}

.state--error {
  background: #fef2f2;
  color: #991b1b;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.state--warning {
  background: #fff7ed;
  color: #9a3412;
}
</style>
