<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, UserSearch, Pill, ArrowRight } from '@lucide/vue'
import { usePersonSearch } from '@/composables/usePersons'
import { useZones } from '@/composables/useZones'
import {
  GENDER_LABELS, RELATIONSHIP_LABELS, SPECIAL_CONDITION_LABELS, ageFromBirthDate,
} from '@/types/person.types'
import { apiErrorStatus } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import FormField from '@/components/form/FormField.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FamilyStatusBadge from '@/components/ui/FamilyStatusBadge.vue'

const router = useRouter()
const input = ref('')
const term = ref('')
const inputError = ref('')

const { data, isLoading, isError, error } = usePersonSearch(term)
const { data: zones } = useZones()

const person = computed(() => data.value?.person)
const family = computed(() => data.value?.family)
const zoneName = computed(() =>
  family.value ? ((zones.value ?? []).find((z) => z.id === family.value!.zone_id)?.name ?? '—') : '—',
)
const notFound = computed(() => isError.value && apiErrorStatus(error.value) === 404)

function submit() {
  const v = input.value.trim()
  if (v.length < 3) {
    inputError.value = 'Ingresa al menos 3 caracteres del documento.'
    return
  }
  inputError.value = ''
  term.value = v
}

function ageLabel(birth: string) {
  const a = ageFromBirthDate(birth)
  return a <= 0 ? '< 1 año' : `${a} años`
}
</script>

<template>
  <section class="mx-auto max-w-2xl space-y-5">
    <PageHeader
      title="Búsqueda de personas"
      crumb="Censo"
      subtitle="Localiza a una persona por su número de documento (HU-06)"
    />

    <form class="flex items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4" @submit.prevent="submit">
      <div class="flex-1">
        <FormField label="Documento de identidad" :error="inputError" input-id="ps-doc">
          <input
            id="ps-doc"
            v-model="input"
            class="control"
            placeholder="Ej. 1063xxxxxx"
            autofocus
          />
        </FormField>
      </div>
      <AppButton type="submit" class="mb-0.5"><Search /> Buscar</AppButton>
    </form>

    <!-- Estado inicial -->
    <div v-if="!term" class="rounded-lg border border-neutral-200 bg-white">
      <EmptyState title="Busca a una persona" message="Escribe el documento y presiona Buscar para ver sus datos y su familia.">
        <template #icon><UserSearch /></template>
      </EmptyState>
    </div>

    <!-- Cargando -->
    <div v-else-if="isLoading" class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
      <SkeletonBlock height="28px" />
      <SkeletonBlock height="80px" />
    </div>

    <!-- No encontrado -->
    <div v-else-if="notFound" class="rounded-lg border border-neutral-200 bg-white">
      <EmptyState title="Sin resultados" :message="`No se encontró ninguna persona con el documento «${term}».`">
        <template #icon><UserSearch /></template>
      </EmptyState>
    </div>

    <!-- Otro error -->
    <div v-else-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center text-sm text-danger">
      Ocurrió un error al realizar la búsqueda. Intenta de nuevo.
    </div>

    <!-- Resultado -->
    <div v-else-if="person && family" class="space-y-4">
      <div class="rounded-lg border border-neutral-200 bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-neutral-900">{{ person.name }}</h2>
            <p class="font-mono text-sm text-neutral-500">{{ person.document }}</p>
          </div>
          <span
            v-if="person.requires_medication"
            class="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning"
          >
            <Pill class="h-3.5 w-3.5" /> Requiere medicación
          </span>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-neutral-500">Edad</dt>
            <dd class="font-medium text-neutral-900">{{ ageLabel(person.birth_date) }}</dd>
          </div>
          <div>
            <dt class="text-neutral-500">Sexo</dt>
            <dd class="font-medium text-neutral-900">{{ GENDER_LABELS[person.gender] }}</dd>
          </div>
          <div>
            <dt class="text-neutral-500">Parentesco</dt>
            <dd class="font-medium text-neutral-900">{{ RELATIONSHIP_LABELS[person.relationship] }}</dd>
          </div>
        </dl>

        <div v-if="person.special_conditions.length" class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="c in person.special_conditions"
            :key="c"
            class="rounded-full bg-info-bg px-2.5 py-1 text-xs text-primary-700"
          >
            {{ SPECIAL_CONDITION_LABELS[c] }}
          </span>
        </div>
      </div>

      <!-- Familia asociada -->
      <div class="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 class="mb-3 text-sm font-semibold text-neutral-700">Familia asociada</h3>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="font-mono font-semibold text-neutral-900">{{ family.family_code }}</span>
              <FamilyStatusBadge :status="family.status" />
            </div>
            <p class="text-sm text-neutral-500">
              Jefe de hogar: <span class="font-mono">{{ family.head_document }}</span> ·
              {{ family.num_members }} integrante(s) · {{ zoneName }}
            </p>
          </div>
          <AppButton variant="outline" size="sm" @click="router.push(`/families/${family.id}`)">
            Ver familia <ArrowRight />
          </AppButton>
        </div>
      </div>
    </div>
  </section>
</template>
