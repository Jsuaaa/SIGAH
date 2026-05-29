<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  ArrowLeft, Pencil, Trash2, UserPlus, Users, Truck, ShieldCheck,
  CheckCircle2, XCircle, RotateCcw, Pill,
} from '@lucide/vue'
import {
  useFamily, useFamilyPersons, useFamilyDeliveries, useFamilyEligibility, useFamilyMutations,
} from '@/composables/useFamilies'
import { usePersonMutations } from '@/composables/usePersons'
import { useZones } from '@/composables/useZones'
import { useShelters } from '@/composables/useShelters'
import type { FamilyScoreBreakdown } from '@/types/family.types'
import {
  RELATIONSHIP_LABELS, RELATIONSHIP_OPTIONS, GENDER_OPTIONS,
  SPECIAL_CONDITION_OPTIONS, SPECIAL_CONDITION_LABELS, ageFromBirthDate,
} from '@/types/person.types'
import type { Person, PersonPayload, SpecialCondition } from '@/types/person.types'
import type { Delivery } from '@/types/delivery.types'
import { personSchema } from '@/schemas/person.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import FamilyStatusBadge from '@/components/ui/FamilyStatusBadge.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ScoreBreakdown from '@/components/ui/ScoreBreakdown.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const route = useRoute()
const router = useRouter()
const familyId = computed(() => Number(route.params.id))

const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'CENSADOR'] as const
const DELETE_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const { data: family, isLoading, isError, refetch } = useFamily(familyId)
const { data: persons, isLoading: loadingPersons } = useFamilyPersons(familyId)
const { data: deliveries, isLoading: loadingDeliveries } = useFamilyDeliveries(familyId)
const { data: eligibility, isLoading: loadingEligibility } = useFamilyEligibility(familyId)
const { data: zones } = useZones()
const { data: shelters } = useShelters()
const { remove: removeFamily } = useFamilyMutations()
const personMut = usePersonMutations()

const zone = computed(() => (zones.value ?? []).find((z) => z.id === family.value?.zone_id))
const shelter = computed(() =>
  family.value?.shelter_id ? (shelters.value ?? []).find((s) => s.id === family.value!.shelter_id) : undefined,
)

const asPerson = (r: unknown) => r as Person
const asDelivery = (r: unknown) => r as Delivery

// --- Puntaje de prioridad (HU-08 CA2) -----------------------------------------
const breakdown = computed(() => family.value?.priority_score_breakdown as FamilyScoreBreakdown | undefined)
const scoreFactors = computed(() => {
  const b = breakdown.value
  if (!b || typeof b.members !== 'number') return []
  const raw = [
    { name: 'Integrantes', points: b.members },
    { name: 'Niños < 5', points: b.children_u5 },
    { name: 'Adultos > 65', points: b.adults_o65 },
    { name: 'Gestantes', points: b.pregnant },
    { name: 'Discapacidad', points: b.disabled },
    { name: 'Riesgo de zona', points: b.zone_risk },
    { name: 'Días sin ayuda', points: b.days_no_aid },
  ]
  const maxPts = Math.max(1, ...raw.map((f) => f.points))
  return raw.map((f) => ({ name: f.name, points: Math.round(f.points), max: Math.round(maxPts) }))
})
const positiveSum = computed(() => scoreFactors.value.reduce((a, f) => a + f.points, 0))
const deliveriesPenalty = computed(() => Math.round(breakdown.value?.deliveries ?? 0))
const scoreValue = computed(() => Math.round(family.value?.priority_score ?? 0))

// --- Pestañas -----------------------------------------------------------------
type Tab = 'members' | 'deliveries' | 'eligibility'
const tab = ref<Tab>('members')
const tabs = computed(() => [
  { key: 'members' as Tab, label: 'Miembros', icon: Users, count: persons.value?.length },
  { key: 'deliveries' as Tab, label: 'Entregas', icon: Truck, count: deliveries.value?.length },
  { key: 'eligibility' as Tab, label: 'Elegibilidad', icon: ShieldCheck, count: undefined as number | undefined },
])

const personColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'document', label: 'Documento', mono: true },
  { key: 'age', label: 'Edad', align: 'center' as const },
  { key: 'relationship', label: 'Parentesco' },
  { key: 'conditions', label: 'Condiciones' },
  { key: 'actions', label: '', align: 'right' as const },
]
const deliveryColumns = [
  { key: 'delivery_code', label: 'Código', mono: true },
  { key: 'delivery_date', label: 'Fecha' },
  { key: 'coverage_days', label: 'Cobertura', align: 'center' as const },
  { key: 'items', label: 'Ítems', align: 'center' as const },
  { key: 'status', label: 'Estado' },
]

function ageLabel(birth: string) {
  const a = ageFromBirthDate(birth)
  return a <= 0 ? '< 1 año' : `${a} años`
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

// --- Modal de persona ---------------------------------------------------------
const personModalOpen = ref(false)
const personEditId = ref<number | null>(null)
const personErrors = ref<Record<string, string>>({})
const personSaving = computed(() => personMut.create.isPending.value || personMut.update.isPending.value)
const todayStr = new Date().toISOString().slice(0, 10)

function blankPerson() {
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
const personForm = ref(blankPerson())
const genderOptions = [{ value: '', label: 'Selecciona…' }, ...GENDER_OPTIONS]
const relationshipOptions = [{ value: '', label: 'Selecciona…' }, ...RELATIONSHIP_OPTIONS]

function openCreatePerson() {
  personEditId.value = null
  personForm.value = blankPerson()
  personErrors.value = {}
  personModalOpen.value = true
}
function openEditPerson(p: Person) {
  personEditId.value = p.id
  personForm.value = {
    name: p.name,
    document: p.document,
    birth_date: p.birth_date,
    gender: p.gender,
    relationship: p.relationship,
    special_conditions: [...p.special_conditions],
    requires_medication: p.requires_medication,
  }
  personErrors.value = {}
  personModalOpen.value = true
}
function toggleCondition(c: SpecialCondition) {
  const arr = personForm.value.special_conditions
  const i = arr.indexOf(c)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(c)
}

async function submitPerson() {
  const res = validate(personSchema, { ...personForm.value })
  if (!res.ok) {
    personErrors.value = res.errors
    return
  }
  personErrors.value = {}
  try {
    if (personEditId.value != null) {
      await personMut.update.mutateAsync({ id: personEditId.value, payload: res.data })
      toast.success('Integrante actualizado')
    } else {
      const payload: PersonPayload = { family_id: familyId.value, ...res.data }
      await personMut.create.mutateAsync(payload)
      toast.success('Integrante agregado')
    }
    personModalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo guardar. ¿El documento ya está registrado?'))
  }
}

// --- Eliminar persona ---------------------------------------------------------
const personConfirmOpen = ref(false)
const personTarget = ref<Person | null>(null)
function askDeletePerson(p: Person) {
  personTarget.value = p
  personConfirmOpen.value = true
}
async function confirmDeletePerson() {
  if (!personTarget.value) return
  try {
    await personMut.remove.mutateAsync(personTarget.value.id)
    toast.success('Integrante eliminado')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se puede eliminar al último integrante del núcleo.'))
  } finally {
    personConfirmOpen.value = false
    personTarget.value = null
  }
}

// --- Eliminar familia ---------------------------------------------------------
const familyConfirmOpen = ref(false)
async function confirmDeleteFamily() {
  try {
    await removeFamily.mutateAsync(familyId.value)
    toast.success('Familia eliminada')
    router.push('/families')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo eliminar: la familia tiene integrantes o entregas asociadas.'))
  } finally {
    familyConfirmOpen.value = false
  }
}
</script>

<template>
  <section class="space-y-5">
    <!-- Carga / error -->
    <div v-if="isLoading" class="space-y-4">
      <SkeletonBlock height="120px" />
      <SkeletonBlock height="200px" />
    </div>
    <div v-else-if="isError || !family" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudo cargar la familia.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <template v-else>
      <PageHeader :title="family.family_code" :crumb="`Familias · ${family.head_document}`">
        <template #actions>
          <AppButton variant="outline" @click="router.push('/families')"><ArrowLeft /> Volver</AppButton>
          <RoleGate :roles="[...EDIT_ROLES]">
            <AppButton variant="outline" @click="router.push(`/families/${familyId}/edit`)">
              <Pencil /> Editar
            </AppButton>
          </RoleGate>
          <RoleGate :roles="[...DELETE_ROLES]">
            <AppButton variant="ghost" class="text-danger" @click="familyConfirmOpen = true">
              <Trash2 /> Eliminar
            </AppButton>
          </RoleGate>
        </template>
      </PageHeader>

      <!-- Resumen + Puntaje -->
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <!-- Datos -->
        <div class="space-y-4 lg:col-span-2">
          <div class="rounded-lg border border-neutral-200 bg-white p-5">
            <div class="flex flex-wrap items-center gap-3">
              <FamilyStatusBadge :status="family.status" />
              <span v-if="zone" class="flex items-center gap-2 text-sm text-neutral-600">
                {{ zone.name }} <RiskLevelBadge :level="zone.risk_level" />
              </span>
            </div>
            <dl class="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-neutral-500">Documento jefe</dt>
                <dd class="font-mono font-medium text-neutral-900">{{ family.head_document }}</dd>
              </div>
              <div>
                <dt class="text-neutral-500">Refugio</dt>
                <dd class="font-medium text-neutral-900">{{ shelter?.name ?? 'Sin refugio' }}</dd>
              </div>
              <div>
                <dt class="text-neutral-500">Integrantes</dt>
                <dd class="font-medium text-neutral-900">{{ family.num_members }}</dd>
              </div>
              <div>
                <dt class="text-neutral-500">Dirección</dt>
                <dd class="font-medium text-neutral-900">{{ family.reference_address ?? '—' }}</dd>
              </div>
              <div>
                <dt class="text-neutral-500">Registrada</dt>
                <dd class="font-medium text-neutral-900">{{ fmtDate(family.created_at) }}</dd>
              </div>
            </dl>

            <!-- Composición rápida -->
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-if="family.num_children_under_5" class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                {{ family.num_children_under_5 }} niño(s) &lt; 5
              </span>
              <span v-if="family.num_adults_over_65" class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                {{ family.num_adults_over_65 }} adulto(s) &gt; 65
              </span>
              <span v-if="family.num_pregnant" class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                {{ family.num_pregnant }} gestante(s)
              </span>
              <span v-if="family.num_disabled" class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600">
                {{ family.num_disabled }} con discapacidad
              </span>
            </div>
          </div>

          <!-- Mini-mapa -->
          <div v-if="family.latitude != null && family.longitude != null" class="rounded-lg border border-neutral-200 bg-white p-2">
            <MapPicker
              :latitude="family.latitude"
              :longitude="family.longitude"
              readonly
              height="220px"
            />
          </div>
        </div>

        <!-- Tarjeta de puntaje -->
        <div class="rounded-lg border border-neutral-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-neutral-700">Puntaje de prioridad</h2>
          <ScoreBreakdown
            v-if="scoreFactors.length"
            :factors="scoreFactors"
            :total="scoreValue"
            :out-of="Math.max(positiveSum, scoreValue, 1)"
          />
          <div v-else class="text-center">
            <p class="text-3xl font-bold text-primary-700">{{ scoreValue }}</p>
            <p class="text-sm text-neutral-500">Puntaje de prioridad</p>
          </div>
          <p v-if="deliveriesPenalty < 0" class="mt-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
            Penalización por entregas previas: <strong class="text-neutral-700">{{ deliveriesPenalty }}</strong>
          </p>
        </div>
      </div>

      <!-- Pestañas -->
      <div>
        <div class="flex gap-1 border-b border-neutral-200">
          <button
            v-for="t in tabs"
            :key="t.key"
            :class="[
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700',
            ]"
            @click="tab = t.key"
          >
            <component :is="t.icon" class="h-4 w-4" />
            {{ t.label }}
            <span v-if="t.count != null" class="rounded-full bg-neutral-100 px-1.5 text-xs text-neutral-600">
              {{ t.count }}
            </span>
          </button>
        </div>

        <div class="pt-4">
          <!-- Miembros -->
          <div v-show="tab === 'members'" class="space-y-4">
            <div class="flex justify-end">
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton size="sm" @click="openCreatePerson"><UserPlus /> Agregar miembro</AppButton>
              </RoleGate>
            </div>
            <div v-if="loadingPersons" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
              <SkeletonBlock v-for="n in 4" :key="n" height="40px" />
            </div>
            <DataTable v-else :columns="personColumns" :rows="persons ?? []" row-key="id" min-width="760px">
              <template #name="{ row }">
                <span class="font-medium text-neutral-900">{{ asPerson(row).name }}</span>
                <span v-if="asPerson(row).requires_medication" class="ml-2 inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">
                  <Pill class="h-3 w-3" /> Medicación
                </span>
              </template>
              <template #age="{ row }">{{ ageLabel(asPerson(row).birth_date) }}</template>
              <template #relationship="{ row }">{{ RELATIONSHIP_LABELS[asPerson(row).relationship] }}</template>
              <template #conditions="{ row }">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="c in asPerson(row).special_conditions"
                    :key="c"
                    class="rounded-full bg-info-bg px-2 py-0.5 text-xs text-primary-700"
                  >
                    {{ SPECIAL_CONDITION_LABELS[c] }}
                  </span>
                  <span v-if="!asPerson(row).special_conditions.length" class="text-xs text-neutral-400">—</span>
                </div>
              </template>
              <template #actions="{ row }">
                <div class="flex justify-end gap-1">
                  <RoleGate :roles="[...EDIT_ROLES]">
                    <AppButton variant="ghost" size="sm" @click="openEditPerson(asPerson(row))"><Pencil /></AppButton>
                  </RoleGate>
                  <RoleGate :roles="[...DELETE_ROLES]">
                    <AppButton variant="ghost" size="sm" class="text-danger" @click="askDeletePerson(asPerson(row))">
                      <Trash2 />
                    </AppButton>
                  </RoleGate>
                </div>
              </template>
              <template #empty>
                <EmptyState title="Sin integrantes" message="Agrega los miembros del núcleo familiar para calcular su composición y puntaje.">
                  <template #icon><Users /></template>
                  <template #action>
                    <RoleGate :roles="[...EDIT_ROLES]">
                      <AppButton size="sm" @click="openCreatePerson"><UserPlus /> Agregar miembro</AppButton>
                    </RoleGate>
                  </template>
                </EmptyState>
              </template>
            </DataTable>
          </div>

          <!-- Entregas -->
          <div v-show="tab === 'deliveries'">
            <div v-if="loadingDeliveries" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
              <SkeletonBlock v-for="n in 3" :key="n" height="40px" />
            </div>
            <DataTable v-else :columns="deliveryColumns" :rows="deliveries ?? []" row-key="id" min-width="640px">
              <template #delivery_date="{ row }">{{ fmtDate(asDelivery(row).delivery_date) }}</template>
              <template #coverage_days="{ row }">{{ asDelivery(row).coverage_days }} días</template>
              <template #items="{ row }">{{ asDelivery(row).details?.length ?? '—' }}</template>
              <template #status="{ row }"><StatusBadge :status="asDelivery(row).status" /></template>
              <template #empty>
                <EmptyState title="Sin entregas" message="Esta familia aún no ha recibido entregas de ayuda.">
                  <template #icon><Truck /></template>
                </EmptyState>
              </template>
            </DataTable>
          </div>

          <!-- Elegibilidad -->
          <div v-show="tab === 'eligibility'">
            <div v-if="loadingEligibility" class="rounded-lg border border-neutral-200 bg-white p-6">
              <SkeletonBlock height="80px" />
            </div>
            <div v-else-if="eligibility" class="rounded-lg border border-neutral-200 bg-white p-6">
              <div
                :class="[
                  'flex items-center gap-3 rounded-md border p-4',
                  eligibility.is_eligible
                    ? 'border-success-br bg-success-bg text-success'
                    : 'border-warning-br bg-warning-bg text-warning',
                ]"
              >
                <CheckCircle2 v-if="eligibility.is_eligible" class="h-6 w-6 flex-none" />
                <XCircle v-else class="h-6 w-6 flex-none" />
                <div>
                  <p class="font-semibold">
                    {{ eligibility.is_eligible ? 'Elegible para una nueva entrega' : 'Cobertura vigente' }}
                  </p>
                  <p class="text-sm opacity-90">
                    <template v-if="eligibility.is_eligible">Puede programarse una entrega para esta familia.</template>
                    <template v-else-if="eligibility.days_remaining != null">
                      Faltan {{ eligibility.days_remaining }} día(s) para una nueva entrega (RN-02).
                    </template>
                    <template v-else>La familia tiene una entrega con cobertura activa.</template>
                  </p>
                </div>
              </div>
              <dl class="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt class="text-neutral-500">Última entrega</dt>
                  <dd class="font-medium text-neutral-900">{{ fmtDateTime(eligibility.last_delivery_at) }}</dd>
                </div>
                <div>
                  <dt class="text-neutral-500">Cobertura hasta</dt>
                  <dd class="font-medium text-neutral-900">{{ fmtDateTime(eligibility.coverage_expires) }}</dd>
                </div>
                <div v-if="!eligibility.is_eligible">
                  <dt class="text-neutral-500">Próxima elegibilidad</dt>
                  <dd class="font-medium text-neutral-900">{{ fmtDateTime(eligibility.next_eligible_at) }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal crear / editar persona -->
    <BaseModal
      :open="personModalOpen"
      :title="personEditId != null ? 'Editar integrante' : 'Agregar integrante'"
      max-width="max-w-[600px]"
      @close="personModalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submitPerson">
        <FormField label="Nombre completo" required :error="personErrors.name" input-id="pe-name">
          <input id="pe-name" v-model="personForm.name" class="control" placeholder="Nombre y apellidos" />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Documento" required :error="personErrors.document" input-id="pe-doc">
            <input id="pe-doc" v-model="personForm.document" class="control" placeholder="Documento de identidad" />
          </FormField>
          <FormField label="Fecha de nacimiento" required :error="personErrors.birth_date" input-id="pe-birth">
            <input id="pe-birth" v-model="personForm.birth_date" type="date" :max="todayStr" class="control" />
          </FormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="personForm.gender"
            label="Sexo"
            required
            :options="genderOptions"
            :error="personErrors.gender"
            input-id="pe-gender"
          />
          <SelectField
            v-model="personForm.relationship"
            label="Parentesco"
            required
            :options="relationshipOptions"
            :error="personErrors.relationship"
            input-id="pe-rel"
          />
        </div>

        <FormField label="Condiciones especiales" :error="personErrors.special_conditions">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              v-for="opt in SPECIAL_CONDITION_OPTIONS"
              :key="opt.value"
              class="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                class="h-4 w-4 accent-primary-600"
                :checked="personForm.special_conditions.includes(opt.value)"
                @change="toggleCondition(opt.value)"
              />
              {{ opt.label }}
            </label>
          </div>
        </FormField>

        <label class="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" v-model="personForm.requires_medication" class="h-4 w-4 accent-primary-600" />
          Requiere medicación permanente
        </label>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="personModalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="personSaving" @click="submitPerson">
          {{ personSaving ? 'Guardando…' : personEditId != null ? 'Guardar' : 'Agregar' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación de persona -->
    <ConfirmDialog
      :open="personConfirmOpen"
      title="Eliminar integrante"
      :message="personTarget ? `¿Eliminar a “${personTarget.name}” del núcleo familiar?` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDeletePerson"
      @close="personConfirmOpen = false"
    />

    <!-- Confirmar eliminación de familia -->
    <ConfirmDialog
      :open="familyConfirmOpen"
      title="Eliminar familia"
      :message="family ? `¿Eliminar la familia ${family.family_code}? Esta acción no se puede deshacer.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDeleteFamily"
      @close="familyConfirmOpen = false"
    />
  </section>
</template>
