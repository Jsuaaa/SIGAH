<template>
  <section class="page">
    <PageHeader title="Registrar familia" subtitle="Censo en terreno">
      <template #actions>
        <AppButton variant="ghost" @click="goBack">Volver</AppButton>
      </template>
    </PageHeader>

    <div v-if="!isOnline" class="state state--warning">
      Estás sin conexión. Se requiere conexión a internet para registrar la familia.
      <!-- TODO HU-04 CA4: encolar en IndexedDB cuando se implemente la cola offline (PLAN paso 15) -->
    </div>

    <div v-if="created" class="success-panel">
      <h2>Familia registrada</h2>
      <p>
        Código: <strong>{{ created.family_code }}</strong>
      </p>
      <p>
        Puntaje de prioridad asignado:
        <strong>{{ created.priority_score }}</strong>
      </p>
      <div class="actions">
        <AppButton @click="goToDetail">Ver familia</AppButton>
        <AppButton variant="ghost" @click="registerAnother">Registrar otra</AppButton>
      </div>
    </div>

    <form v-else class="form" @submit.prevent="submit">
      <FormField label="Documento del jefe de familia" :error="errors.head_document" required>
        <input v-model="form.head_document" class="control" type="text" autocomplete="off" />
      </FormField>

      <SelectField
        v-model="form.zone_id"
        label="Zona"
        required
        :options="zoneOptions"
        :error="errors.zone_id"
        :disabled="zonesQuery.isLoading.value"
      />

      <SelectField
        v-model="form.shelter_id"
        label="Refugio"
        :options="shelterOptions"
        :error="errors.shelter_id"
        :disabled="sheltersQuery.isLoading.value"
      />

      <SelectField
        v-model="form.status"
        label="Estado"
        :options="statusOptions"
        :error="errors.status"
      />

      <FormField label="Número de integrantes" :error="errors.num_members" required>
        <input v-model="form.num_members" class="control" type="number" min="1" />
      </FormField>

      <div class="grid-2">
        <FormField label="Menores de 5 años" :error="errors.num_children_under_5">
          <input v-model="form.num_children_under_5" class="control" type="number" min="0" />
        </FormField>
        <FormField label="Adultos mayores de 65" :error="errors.num_adults_over_65">
          <input v-model="form.num_adults_over_65" class="control" type="number" min="0" />
        </FormField>
        <FormField label="Mujeres embarazadas" :error="errors.num_pregnant">
          <input v-model="form.num_pregnant" class="control" type="number" min="0" />
        </FormField>
        <FormField label="Personas con discapacidad" :error="errors.num_disabled">
          <input v-model="form.num_disabled" class="control" type="number" min="0" />
        </FormField>
      </div>

      <FormField label="Dirección de referencia" :error="errors.reference_address">
        <input v-model="form.reference_address" class="control" type="text" />
      </FormField>

      <div class="map-block">
        <span class="map-block__label">Ubicación (opcional)</span>
        <MapPicker
          v-model:latitude="form.latitude"
          v-model:longitude="form.longitude"
          height="240px"
        />
      </div>

      <FormField :error="errors.privacy_consent_accepted">
        <PrivacyConsentCheckbox v-model="form.privacy_consent_accepted" />
      </FormField>

      <div class="actions">
        <AppButton type="button" variant="ghost" @click="goBack">Cancelar</AppButton>
        <AppButton type="submit" :disabled="familyMutations.create.isPending.value || !isOnline">
          {{ familyMutations.create.isPending.value ? 'Guardando…' : 'Guardar' }}
        </AppButton>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useZones } from '@/composables/useZones';
import { useShelters } from '@/composables/useShelters';
import { useFamilyMutations } from '@/composables/useFamilies';
import { familyCreateSchema } from '@/schemas/family.schema';
import { FAMILY_STATUS_OPTIONS, type Family, type FamilyPayload } from '@/types/family.types';
import { validate } from '@/utils/validation';
import { apiErrorMessage } from '@/utils/apiError';
import { toast } from 'vue-sonner';
import PageHeader from '@/components/ui/PageHeader.vue';
import AppButton from '@/components/ui/AppButton.vue';
import FormField from '@/components/form/FormField.vue';
import SelectField from '@/components/form/SelectField.vue';
import MapPicker from '@/components/form/MapPicker.vue';
import PrivacyConsentCheckbox from '@/components/form/PrivacyConsentCheckbox.vue';

const router = useRouter();
const zonesQuery = useZones();
const sheltersQuery = useShelters();
const familyMutations = useFamilyMutations();

const created = ref<Family | null>(null);

const isOnline = ref(navigator.onLine);
function updateOnline() {
  isOnline.value = navigator.onLine;
}
onMounted(() => {
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
});
onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnline);
  window.removeEventListener('offline', updateOnline);
});

const statusOptions = FAMILY_STATUS_OPTIONS;

const zoneOptions = computed(() => [
  { value: '', label: 'Selecciona una zona' },
  ...(zonesQuery.data.value ?? []).map((z) => ({ value: z.id, label: z.name })),
]);

const shelterOptions = computed(() => [
  { value: '', label: 'Sin refugio' },
  ...(sheltersQuery.data.value ?? []).map((s) => ({ value: s.id, label: s.name })),
]);

const form = reactive({
  head_document: '',
  zone_id: '' as string | number,
  shelter_id: '' as string | number,
  status: 'ACTIVO' as string,
  num_members: '1' as string | number,
  num_children_under_5: '0' as string | number,
  num_adults_over_65: '0' as string | number,
  num_pregnant: '0' as string | number,
  num_disabled: '0' as string | number,
  reference_address: '',
  latitude: null as number | null,
  longitude: null as number | null,
  privacy_consent_accepted: false,
});

const errors = reactive<Record<string, string>>({});

function resetErrors() {
  Object.keys(errors).forEach((k) => delete errors[k]);
}

function goBack() {
  router.push('/families');
}

function goToDetail() {
  if (created.value) {
    router.push(`/families/${created.value.id}`);
  }
}

function registerAnother() {
  created.value = null;
  resetErrors();
  Object.assign(form, {
    head_document: '',
    zone_id: '',
    shelter_id: '',
    status: 'ACTIVO',
    num_members: '1',
    num_children_under_5: '0',
    num_adults_over_65: '0',
    num_pregnant: '0',
    num_disabled: '0',
    reference_address: '',
    latitude: null,
    longitude: null,
    privacy_consent_accepted: false,
  });
}

async function submit() {
  resetErrors();

  if (!isOnline.value) {
    // TODO HU-04 CA4: encolar en IndexedDB cuando se implemente la cola offline (PLAN paso 15)
    toast.error('Se requiere conexión a internet para registrar la familia.');
    return;
  }

  const result = validate(familyCreateSchema, {
    head_document: form.head_document,
    zone_id: form.zone_id === '' ? undefined : form.zone_id,
    shelter_id: form.shelter_id === '' ? null : form.shelter_id,
    status: form.status,
    num_members: form.num_members,
    num_children_under_5: form.num_children_under_5,
    num_adults_over_65: form.num_adults_over_65,
    num_pregnant: form.num_pregnant,
    num_disabled: form.num_disabled,
    reference_address: form.reference_address === '' ? null : form.reference_address,
    latitude: form.latitude,
    longitude: form.longitude,
    privacy_consent_accepted: form.privacy_consent_accepted,
  });

  if (!result.ok) {
    Object.assign(errors, result.errors);
    return;
  }

  try {
    const family = await familyMutations.create.mutateAsync(result.data as FamilyPayload);
    created.value = family;
    toast.success(`Familia registrada. Puntaje de prioridad: ${family.priority_score}`);
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 640px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.map-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.map-block__label {
  font-size: 0.85rem;
  font-weight: 600;
}

.state--warning {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: #fff7ed;
  color: #9a3412;
  margin-bottom: 1rem;
}

.success-panel {
  max-width: 640px;
  padding: 1.25rem;
  border-radius: 0.75rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
