<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, Save, Info } from '@lucide/vue'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import { useFamily, useFamilyMutations } from '@/composables/useFamilies'
import { FAMILY_STATUS_OPTIONS } from '@/types/family.types'
import type { FamilyCreatePayload, FamilyStatus, FamilyUpdatePayload } from '@/types/family.types'
import { familyCreateSchema, familyEditSchema } from '@/schemas/family.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import { useOfflineSync } from '@/composables/useOfflineSync'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import PrivacyConsentCheckbox from '@/components/form/PrivacyConsentCheckbox.vue'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => route.name === 'family-edit')
const familyId = computed(() => (isEdit.value ? Number(route.params.id) : 0))

const { data: family, isLoading: loadingFamily, isError: familyError } = useFamily(familyId)
const { data: zones } = useZones()
const { data: shelters } = useShelters()
const { create, update } = useFamilyMutations()
const offline = useOfflineSync()
const saving = computed(() => create.isPending.value || update.isPending.value)

// Clave de idempotencia estable por instancia del formulario: un reintento de un
// alta (corte de red / cola offline) deduplica en el backend (HU-04 CA5).
const clientOpId = ref(crypto.randomUUID())

const zoneOptions = computed(() => [
  { value: '', label: 'Selecciona la zona…' },
  ...(zones.value ?? []).map((z) => ({ value: String(z.id), label: z.name })),
])
const shelterOptions = computed(() => [
  { value: '', label: 'Sin refugio asignado' },
  ...(shelters.value ?? []).map((s) => ({ value: String(s.id), label: s.name })),
])
const statusOptions = FAMILY_STATUS_OPTIONS.map((s) => ({ value: s.value as string, label: s.label }))

function blankForm() {
  return {
    head_document: '',
    zone_id: '',
    shelter_id: '',
    status: 'ACTIVO' as FamilyStatus,
    reference_address: '',
    num_members: '',
    num_children_under_5: '',
    num_adults_over_65: '',
    num_pregnant: '',
    num_disabled: '',
    latitude: null as number | null,
    longitude: null as number | null,
  }
}
const form = ref(blankForm())
const consent = ref(false)
const errors = ref<Record<string, string>>({})

// En edición, precarga el formulario con la familia cargada.
watch(
  family,
  (f) => {
    if (!f) return
    form.value = {
      head_document: f.head_document,
      zone_id: String(f.zone_id),
      shelter_id: f.shelter_id != null ? String(f.shelter_id) : '',
      status: f.status,
      reference_address: f.reference_address ?? '',
      num_members: String(f.num_members),
      num_children_under_5: String(f.num_children_under_5),
      num_adults_over_65: String(f.num_adults_over_65),
      num_pregnant: String(f.num_pregnant),
      num_disabled: String(f.num_disabled),
      latitude: f.latitude,
      longitude: f.longitude,
    }
  },
  { immediate: true },
)

function clearLocation() {
  form.value.latitude = null
  form.value.longitude = null
}

async function submit() {
  errors.value = {}

  if (isEdit.value) {
    const res = validate(familyEditSchema, {
      head_document: form.value.head_document,
      zone_id: form.value.zone_id,
      shelter_id: form.value.shelter_id,
      status: form.value.status,
      reference_address: form.value.reference_address,
    })
    if (!res.ok) {
      errors.value = res.errors
      return
    }
    const payload: FamilyUpdatePayload = {
      head_document: res.data.head_document,
      zone_id: res.data.zone_id,
      shelter_id: res.data.shelter_id,
      status: res.data.status,
      reference_address: res.data.reference_address?.trim() ? res.data.reference_address : null,
      latitude: form.value.latitude,
      longitude: form.value.longitude,
    }
    try {
      await update.mutateAsync({ id: familyId.value, payload })
      toast.success('Familia actualizada')
      router.push(`/families/${familyId.value}`)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
    return
  }

  // Alta.
  const res = validate(familyCreateSchema, {
    head_document: form.value.head_document,
    zone_id: form.value.zone_id,
    shelter_id: form.value.shelter_id,
    status: form.value.status,
    reference_address: form.value.reference_address,
    num_members: form.value.num_members,
    num_children_under_5: form.value.num_children_under_5,
    num_adults_over_65: form.value.num_adults_over_65,
    num_pregnant: form.value.num_pregnant,
    num_disabled: form.value.num_disabled,
    privacy_consent_accepted: consent.value,
  })
  if (!res.ok) {
    errors.value = res.errors
    return
  }
  const payload: FamilyCreatePayload = {
    head_document: res.data.head_document,
    zone_id: res.data.zone_id,
    shelter_id: res.data.shelter_id,
    num_members: res.data.num_members,
    num_children_under_5: res.data.num_children_under_5,
    num_adults_over_65: res.data.num_adults_over_65,
    num_pregnant: res.data.num_pregnant,
    num_disabled: res.data.num_disabled,
    status: res.data.status,
    reference_address: res.data.reference_address?.trim() ? res.data.reference_address : null,
    latitude: form.value.latitude,
    longitude: form.value.longitude,
    privacy_consent_accepted: true,
  }
  try {
    // Censo offline (HU-04 CA5): si no hay conexión, se guarda localmente y se
    // sincroniza al reconectar (dedup por client_op_id).
    const res = await offline.submit({
      entity: 'family',
      url: '/api/v1/families',
      payload,
      clientOpId: clientOpId.value,
      label: `Familia (doc ${payload.head_document})`,
      run: () => create.mutateAsync({ payload, clientOpId: clientOpId.value }),
    })
    if (res.status === 'sent') {
      toast.success(`Familia ${res.data.family_code} registrada`)
      router.push(`/families/${res.data.id}`)
    } else {
      toast.success('Sin conexión: familia guardada localmente. Se sincronizará al reconectar.')
      router.push('/families')
    }
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo registrar la familia. ¿El documento ya existe?'))
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-5">
    <PageHeader
      :title="isEdit ? 'Editar familia' : 'Registrar familia'"
      crumb="Censo"
      :subtitle="
        isEdit
          ? 'Actualiza los datos del núcleo familiar'
          : 'Censo del núcleo familiar (Ley 1581/2012)'
      "
    >
      <template #actions>
        <AppButton variant="outline" @click="router.push(isEdit ? `/families/${familyId}` : '/families')">
          <ArrowLeft /> Volver
        </AppButton>
      </template>
    </PageHeader>

    <!-- Estados de carga / error en edición -->
    <div v-if="isEdit && loadingFamily" class="space-y-3 rounded-lg border border-neutral-200 bg-white p-6">
      <SkeletonBlock v-for="n in 6" :key="n" height="48px" />
    </div>
    <div
      v-else-if="isEdit && familyError"
      class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center text-sm text-danger"
    >
      No se pudo cargar la familia.
    </div>

    <form v-else class="space-y-5" @submit.prevent="submit">
      <!-- Datos básicos -->
      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Datos básicos</legend>

        <FormField
          label="Documento del jefe de hogar"
          required
          :error="errors.head_document"
          input-id="fa-doc"
          hint="Cédula o documento de identidad del responsable del núcleo."
        >
          <input id="fa-doc" v-model="form.head_document" class="control" placeholder="Ej. 1063xxxxxx" />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.zone_id"
            label="Zona"
            required
            :options="zoneOptions"
            :error="errors.zone_id"
            input-id="fa-zone"
          />
          <SelectField
            v-model="form.shelter_id"
            label="Refugio"
            :options="shelterOptions"
            :error="errors.shelter_id"
            input-id="fa-shelter"
            hint="Opcional: solo si la familia está alojada en un refugio."
          />
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.status"
            label="Estado"
            required
            :options="statusOptions"
            :error="errors.status"
            input-id="fa-status"
          />
          <FormField label="Dirección de referencia" :error="errors.reference_address" input-id="fa-addr">
            <input id="fa-addr" v-model="form.reference_address" class="control" placeholder="Barrio, calle…" />
          </FormField>
        </div>
      </fieldset>

      <!-- Composición -->
      <fieldset class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Composición familiar</legend>

        <template v-if="!isEdit">
          <FormField
            label="Total de integrantes"
            required
            :error="errors.num_members"
            input-id="fa-members"
            hint="Personas que componen el núcleo familiar."
          >
            <input id="fa-members" v-model="form.num_members" type="number" min="1" class="control" placeholder="0" />
          </FormField>

          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <FormField label="Niños < 5" :error="errors.num_children_under_5" input-id="fa-c5">
              <input id="fa-c5" v-model="form.num_children_under_5" type="number" min="0" class="control" placeholder="0" />
            </FormField>
            <FormField label="Adultos > 65" :error="errors.num_adults_over_65" input-id="fa-a65">
              <input id="fa-a65" v-model="form.num_adults_over_65" type="number" min="0" class="control" placeholder="0" />
            </FormField>
            <FormField label="Gestantes" :error="errors.num_pregnant" input-id="fa-preg">
              <input id="fa-preg" v-model="form.num_pregnant" type="number" min="0" class="control" placeholder="0" />
            </FormField>
            <FormField label="Discapacidad" :error="errors.num_disabled" input-id="fa-dis">
              <input id="fa-dis" v-model="form.num_disabled" type="number" min="0" class="control" placeholder="0" />
            </FormField>
          </div>
        </template>

        <!-- En edición, la composición se deriva de las personas (#14): solo lectura. -->
        <div v-else class="space-y-3">
          <div class="flex items-start gap-2 rounded-md bg-primary-50 p-3 text-sm text-primary-800">
            <Info class="mt-0.5 h-4 w-4 flex-none" />
            <span>
              La composición se calcula a partir de los integrantes registrados. Para modificarla,
              gestiona los miembros desde el detalle de la familia.
            </span>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div v-for="c in [
              { label: 'Integrantes', value: form.num_members },
              { label: 'Niños < 5', value: form.num_children_under_5 },
              { label: 'Adultos > 65', value: form.num_adults_over_65 },
              { label: 'Gestantes', value: form.num_pregnant },
              { label: 'Discapacidad', value: form.num_disabled },
            ]" :key="c.label" class="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-center">
              <p class="text-lg font-bold text-neutral-900">{{ c.value || 0 }}</p>
              <p class="text-xs text-neutral-500">{{ c.label }}</p>
            </div>
          </div>
        </div>
      </fieldset>

      <!-- Ubicación (opcional) -->
      <fieldset class="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <legend class="px-1 text-sm font-semibold text-neutral-700">Ubicación (opcional)</legend>
        <div class="flex items-center justify-between">
          <p class="text-sm text-neutral-500">
            Toca el mapa para ubicar el hogar; arrastra el marcador para ajustar.
          </p>
          <AppButton
            v-if="form.latitude != null"
            type="button"
            variant="ghost"
            size="sm"
            @click="clearLocation"
          >
            Quitar ubicación
          </AppButton>
        </div>
        <MapPicker v-model:latitude="form.latitude" v-model:longitude="form.longitude" height="260px" />
        <p v-if="form.latitude != null" class="font-mono text-xs text-neutral-500">
          {{ form.latitude?.toFixed(6) }}, {{ form.longitude?.toFixed(6) }}
        </p>
      </fieldset>

      <!-- Consentimiento (solo alta, RN-09) -->
      <div v-if="!isEdit" class="space-y-1">
        <PrivacyConsentCheckbox v-model="consent" />
        <p v-if="errors.privacy_consent_accepted" class="flex items-center gap-1.5 text-sm text-danger">
          {{ errors.privacy_consent_accepted }}
        </p>
      </div>

      <!-- Acciones -->
      <div class="flex items-center justify-end gap-3 pb-4">
        <AppButton variant="ghost" type="button" @click="router.push(isEdit ? `/families/${familyId}` : '/families')">
          Cancelar
        </AppButton>
        <AppButton type="submit" :disabled="saving || (!isEdit && !consent)">
          <Save /> {{ saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar familia' }}
        </AppButton>
      </div>
    </form>
  </section>
</template>
