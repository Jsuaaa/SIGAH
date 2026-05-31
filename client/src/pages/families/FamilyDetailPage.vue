<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { ArrowLeft, MapPin, Users, Plus, SearchX, Trash2, Pencil } from '@lucide/vue'
import { useFamily, useFamilyMutations } from '@/composables/useFamilies'
import { useFamilyPersons, usePersonMutations } from '@/composables/usePersons'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import type { Person, PersonPayload, SpecialCondition } from '@/types/person.types'
import {
  GENDER_OPTIONS, RELATIONSHIP_OPTIONS, SPECIAL_CONDITION_OPTIONS,
  GENDER_LABELS, RELATIONSHIP_LABELS, SPECIAL_CONDITION_LABELS,
} from '@/types/person.types'

const genderFormOptions = [{ value: '', label: 'Selecciona el género…' }, ...GENDER_OPTIONS]
const relationshipFormOptions = [{ value: '', label: 'Selecciona el parentesco…' }, ...RELATIONSHIP_OPTIONS]
import { personCreateSchema } from '@/schemas/person.schema'
import { familyUpdateSchema } from '@/schemas/family.schema'
import { FAMILY_STATUS_OPTIONS } from '@/types/family.types'
import type { FamilyUpdatePayload } from '@/types/family.types'
import MapPicker from '@/components/form/MapPicker.vue'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import FamilyStatusBadge from '@/components/ui/FamilyStatusBadge.vue'
import ScoreBreakdown from '@/components/ui/ScoreBreakdown.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))

const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'] as const
const DELETE_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const { data: family, isLoading, isError } = useFamily(id)
const { data: persons } = useFamilyPersons(id)
const { data: zones } = useZones()
const { data: shelters } = useShelters()
const { create, remove } = usePersonMutations(id)
const { update } = useFamilyMutations()

// Nombres de zona/refugio (Family solo trae los ids).
const zone = computed(() => zones.value?.find((z) => z.id === family.value?.zone_id) ?? null)
const shelter = computed(() =>
  family.value?.shelter_id ? shelters.value?.find((s) => s.id === family.value!.shelter_id) ?? null : null,
)

// HU-08: mapeo del desglose del puntaje a los factores de ScoreBreakdown.
const scoreFactors = computed(() => {
  const b = family.value?.priority_score_breakdown
  return [
    { name: 'Menores de 5 años', points: b?.children_under_5 ?? 0, max: 32 },
    { name: 'Adultos mayores de 65', points: b?.adults_over_65 ?? 0, max: 24 },
    { name: 'Mujeres embarazadas', points: b?.pregnant ?? 0, max: 21 },
    { name: 'Personas con discapacidad', points: b?.disabled ?? 0, max: 21 },
    { name: 'Riesgo de la zona', points: b?.zone_risk ?? 0, max: 20 },
  ]
})

// HU-05: tabla de integrantes.
const personCols = [
  { key: 'name', label: 'Nombre' },
  { key: 'document', label: 'Documento', mono: true },
  { key: 'age', label: 'Edad', align: 'center' as const },
  { key: 'gender', label: 'Género' },
  { key: 'relationship', label: 'Parentesco' },
  { key: 'special_conditions', label: 'Condiciones especiales' },
  { key: 'requires_medication', label: 'Medicación', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]
const asPerson = (r: unknown) => r as Person

// --- Modal: agregar persona ---------------------------------------------------
const modalOpen = ref(false)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    name: '',
    document: '',
    birth_date: '',
    gender: '',
    relationship: '',
    special_conditions: [] as SpecialCondition[],
    requires_medication: false,
  }
}
const form = ref(blankForm())
const saving = computed(() => create.isPending.value)

function openCreate() {
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}

async function submit() {
  const res = validate(personCreateSchema, { ...form.value })
  if (!res.ok) {
    errors.value = res.errors
    return
  }
  errors.value = {}
  const payload: PersonPayload = { ...res.data, family_id: id.value }
  try {
    await create.mutateAsync(payload)
    toast.success('Integrante agregado')
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Modal: editar familia (HU-07) -------------------------------------------
const editOpen = ref(false)
const editErrors = ref<Record<string, string>>({})
function blankEditForm() {
  return {
    head_document: '',
    zone_id: '' as number | '',
    shelter_id: '' as number | '',
    status: 'ACTIVO' as string,
    reference_address: '' as string,
    latitude: null as number | null,
    longitude: null as number | null,
  }
}
const editForm = ref(blankEditForm())
const editSaving = computed(() => update.isPending.value)

// Selects de catálogos: zona obligatoria, refugio opcional ("Sin refugio").
const zoneOptions = computed(() => [
  { value: '', label: 'Selecciona la zona…' },
  ...(zones.value ?? []).map((z) => ({ value: z.id, label: z.name })),
])
const shelterOptions = computed(() => [
  { value: '', label: 'Sin refugio' },
  ...(shelters.value ?? []).map((s) => ({ value: s.id, label: s.name })),
])

function openEdit() {
  const f = family.value
  if (!f) return
  editForm.value = {
    head_document: f.head_document,
    zone_id: f.zone_id,
    shelter_id: f.shelter_id ?? '',
    status: f.status,
    reference_address: f.reference_address ?? '',
    latitude: f.latitude,
    longitude: f.longitude,
  }
  editErrors.value = {}
  editOpen.value = true
}

async function submitEdit() {
  const res = validate(familyUpdateSchema, { ...editForm.value })
  if (!res.ok) {
    editErrors.value = res.errors
    return
  }
  editErrors.value = {}
  const d = res.data
  const payload: FamilyUpdatePayload = {
    head_document: d.head_document,
    zone_id: d.zone_id,
    shelter_id: d.shelter_id ?? null,
    status: d.status,
    latitude: editForm.value.latitude,
    longitude: editForm.value.longitude,
    reference_address: d.reference_address ? d.reference_address : null,
  }
  try {
    await update.mutateAsync({ id: id.value, payload })
    toast.success('Familia actualizada')
    editOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Eliminar persona ---------------------------------------------------------
const confirmOpen = ref(false)
const target = ref<Person | null>(null)
function askDelete(person: Person) {
  target.value = person
  confirmOpen.value = true
}
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Integrante eliminado')
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <!-- Carga / error -->
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="40px" width="280px" />
      <SkeletonBlock height="200px" rounded="12px" />
    </div>
    <div v-else-if="isError || !family" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la familia.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="router.push('/families')">
        <ArrowLeft /> Volver a familias
      </AppButton>
    </div>

    <template v-else>
      <PageHeader :title="`Familia ${family.family_code}`" crumb="Familias">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/families')"><ArrowLeft /> Volver</AppButton>
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton @click="openEdit"><Pencil /> Editar</AppButton>
          </RoleGate>
        </template>
      </PageHeader>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Datos de la familia -->
        <div class="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xs lg:col-span-2">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold text-neutral-900">Datos de la familia</h2>
            <FamilyStatusBadge :status="family.status" />
          </div>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm text-neutral-500">Código</dt>
              <dd class="font-mono font-semibold text-neutral-900">{{ family.family_code }}</dd>
            </div>
            <div>
              <dt class="text-sm text-neutral-500">Documento del jefe de hogar</dt>
              <dd class="font-mono text-neutral-900">{{ family.head_document }}</dd>
            </div>
            <div>
              <dt class="text-sm text-neutral-500">Zona</dt>
              <dd class="flex items-center gap-2 text-neutral-900">
                {{ zone?.name ?? '—' }}
                <RiskLevelBadge v-if="zone" :level="zone.risk_level" />
              </dd>
            </div>
            <div>
              <dt class="text-sm text-neutral-500">Refugio</dt>
              <dd class="text-neutral-900">{{ shelter?.name ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-sm text-neutral-500">Integrantes</dt>
              <dd class="flex items-center gap-2 text-neutral-900">
                <Users class="h-4 w-4 text-neutral-400" /> {{ family.num_members }}
              </dd>
            </div>
            <div>
              <dt class="text-sm text-neutral-500">Composición</dt>
              <dd class="text-sm text-neutral-700">
                {{ family.num_children_under_5 }} menor(es) de 5 ·
                {{ family.num_adults_over_65 }} mayor(es) de 65 ·
                {{ family.num_pregnant }} embarazada(s) ·
                {{ family.num_disabled }} con discapacidad
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-sm text-neutral-500">Dirección de referencia</dt>
              <dd class="text-neutral-900">{{ family.reference_address || '—' }}</dd>
            </div>
            <div v-if="family.latitude != null && family.longitude != null" class="sm:col-span-2">
              <dt class="text-sm text-neutral-500">Coordenadas</dt>
              <dd class="flex items-center gap-1.5 font-mono text-xs text-neutral-400">
                <MapPin class="h-3.5 w-3.5" />
                {{ family.latitude.toFixed(5) }}, {{ family.longitude.toFixed(5) }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Puntaje de prioridad (HU-08) -->
        <div class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
          <h2 class="mb-4 text-base font-semibold text-neutral-900">Puntaje de prioridad</h2>
          <ScoreBreakdown
            :factors="scoreFactors"
            :total="family.priority_score_breakdown.total"
            :out-of="100"
          />
        </div>
      </div>

      <!-- Integrantes (HU-05) -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-neutral-900">
            Integrantes <span class="text-neutral-400">({{ persons?.length ?? 0 }})</span>
          </h2>
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton size="sm" @click="openCreate"><Plus /> Agregar persona</AppButton>
          </RoleGate>
        </div>

        <DataTable :columns="personCols" :rows="persons ?? []" row-key="id" min-width="720px">
          <template #name="{ value }"><span class="font-medium text-neutral-900">{{ value }}</span></template>
          <template #gender="{ row }">{{ GENDER_LABELS[asPerson(row).gender] }}</template>
          <template #relationship="{ row }">{{ RELATIONSHIP_LABELS[asPerson(row).relationship] }}</template>
          <template #special_conditions="{ row }">
            <div v-if="asPerson(row).special_conditions.length" class="flex flex-wrap gap-1">
              <span
                v-for="c in asPerson(row).special_conditions"
                :key="c"
                class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                {{ SPECIAL_CONDITION_LABELS[c] }}
              </span>
            </div>
            <span v-else class="text-neutral-400">—</span>
          </template>
          <template #requires_medication="{ row }">
            {{ asPerson(row).requires_medication ? 'Sí' : 'No' }}
          </template>
          <template #actions="{ row }">
            <RoleGate :roles="[...DELETE_ROLES]">
              <AppButton variant="ghost" size="sm" class="text-danger" @click="askDelete(asPerson(row))">
                <Trash2 /> Eliminar
              </AppButton>
            </RoleGate>
          </template>
          <template #empty>
            <EmptyState title="Sin integrantes" message="Esta familia aún no tiene integrantes registrados.">
              <template #icon><SearchX /></template>
              <template #action>
                <RoleGate :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Agregar persona</AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>
    </template>

    <!-- Modal: editar familia (HU-07) -->
    <BaseModal :open="editOpen" title="Editar familia" max-width="max-w-[640px]" @close="editOpen = false">
      <form class="space-y-4" @submit.prevent="submitEdit">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Documento del jefe de hogar" required :error="editErrors.head_document" input-id="fam-doc">
            <input id="fam-doc" v-model="editForm.head_document" class="control" placeholder="Documento" />
          </FormField>
          <SelectField
            v-model="editForm.status"
            label="Estado"
            required
            :options="FAMILY_STATUS_OPTIONS"
            :error="editErrors.status"
            input-id="fam-status"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="editForm.zone_id"
            label="Zona"
            required
            :options="zoneOptions"
            :error="editErrors.zone_id"
            input-id="fam-zone"
          />
          <SelectField
            v-model="editForm.shelter_id"
            label="Refugio"
            :options="shelterOptions"
            :error="editErrors.shelter_id"
            input-id="fam-shelter"
          />
        </div>

        <FormField label="Dirección de referencia" :error="editErrors.reference_address" input-id="fam-addr">
          <input id="fam-addr" v-model="editForm.reference_address" class="control" placeholder="Dirección de referencia" />
        </FormField>

        <FormField label="Ubicación en el mapa" :error="editErrors.latitude || editErrors.longitude">
          <MapPicker
            v-model:latitude="editForm.latitude"
            v-model:longitude="editForm.longitude"
            height="240px"
          />
        </FormField>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="editOpen = false">Cancelar</AppButton>
        <AppButton :disabled="editSaving" @click="submitEdit">
          {{ editSaving ? 'Guardando…' : 'Guardar' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Modal: agregar persona -->
    <BaseModal :open="modalOpen" title="Nuevo integrante" max-width="max-w-[560px]" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="person-name">
          <input id="person-name" v-model="form.name" class="control" placeholder="Nombre completo" />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Documento" required :error="errors.document" input-id="person-doc">
            <input id="person-doc" v-model="form.document" class="control" placeholder="Documento" />
          </FormField>
          <FormField label="Fecha de nacimiento" required :error="errors.birth_date" input-id="person-birth">
            <input id="person-birth" v-model="form.birth_date" type="date" class="control" />
          </FormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.gender"
            label="Género"
            required
            :options="genderFormOptions"
            :error="errors.gender"
            input-id="person-gender"
          />
          <SelectField
            v-model="form.relationship"
            label="Parentesco"
            required
            :options="relationshipFormOptions"
            :error="errors.relationship"
            input-id="person-rel"
          />
        </div>

        <FormField label="Condiciones especiales" :error="errors.special_conditions">
          <div class="space-y-1.5">
            <label
              v-for="opt in SPECIAL_CONDITION_OPTIONS"
              :key="opt.value"
              class="flex items-center gap-2 text-sm text-neutral-700"
            >
              <input v-model="form.special_conditions" type="checkbox" :value="opt.value" />
              {{ opt.label }}
            </label>
          </div>
        </FormField>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="form.requires_medication" type="checkbox" />
          Requiere medicación
        </label>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : 'Agregar' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación de persona -->
    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar integrante"
      :message="target ? `¿Eliminar a “${target.name}”? Esto recalculará el puntaje de la familia.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
