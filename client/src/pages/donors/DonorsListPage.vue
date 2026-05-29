<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Plus, Pencil, Ban, Eye, SearchX, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/vue'
import { useDonorsList, useDonorMutations } from '@/composables/useDonors'
import { DONOR_TYPE_OPTIONS, DONOR_TYPE_LABELS } from '@/types/donor.types'
import type { Donor, DonorListParams, DonorPayload, DonorType } from '@/types/donor.types'
import { donorSchema } from '@/schemas/donor.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SearchInput from '@/components/form/SearchInput.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 20
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] as const
const DELETE_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const search = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const page = ref(1)

const params = computed<DonorListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(search.value ? { search: search.value } : {}),
  ...(typeFilter.value ? { type: typeFilter.value as DonorType } : {}),
  ...(statusFilter.value ? { is_active: statusFilter.value === 'true' } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useDonorsList(params)
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(search.value || typeFilter.value || statusFilter.value))

const typeFilterOptions = [{ value: '', label: 'Todos los tipos' }, ...DONOR_TYPE_OPTIONS]
const typeFormOptions = [{ value: '', label: 'Selecciona el tipo…' }, ...DONOR_TYPE_OPTIONS]
const statusFilterOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]

const columns = [
  { key: 'name', label: 'Donante' },
  { key: 'type', label: 'Tipo' },
  { key: 'contact', label: 'Contacto' },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]
const asDonor = (r: unknown) => r as Donor
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  search.value = ''
  typeFilter.value = ''
  statusFilter.value = ''
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, deactivate } = useDonorMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return { name: '', type: '', contact: '', tax_id: '' }
}
const form = ref(blankForm())

function openCreate() {
  editId.value = null
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function openEdit(d: Donor) {
  editId.value = d.id
  form.value = { name: d.name, type: d.type, contact: d.contact, tax_id: d.tax_id ?? '' }
  errors.value = {}
  modalOpen.value = true
}
async function submit() {
  const res = validate(donorSchema, { ...form.value })
  if (!res.ok) {
    errors.value = res.errors
    return
  }
  errors.value = {}
  const payload: DonorPayload = {
    name: res.data.name,
    type: res.data.type,
    contact: res.data.contact,
    tax_id: res.data.tax_id?.trim() ? res.data.tax_id : null,
  }
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Donante actualizado' : 'Donante creado')
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo guardar. ¿Ya existe un donante con ese nombre y tipo?'))
  }
}

// --- Desactivar ---------------------------------------------------------------
const confirmOpen = ref(false)
const target = ref<Donor | null>(null)
function askDeactivate(d: Donor) {
  target.value = d
  confirmOpen.value = true
}
async function confirmDeactivate() {
  if (!target.value) return
  try {
    await deactivate.mutateAsync(target.value.id)
    toast.success('Donante desactivado')
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
    <PageHeader
      title="Donantes"
      crumb="Ayudas"
      :subtitle="total ? `${total} ${total === 1 ? 'donante' : 'donantes'}` : 'Personas y organizaciones donantes'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Registrar donante</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SearchInput v-model="search" placeholder="Buscar por nombre…" />
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los donantes.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="820px">
          <template #name="{ row }"><span class="font-semibold text-neutral-900">{{ asDonor(row).name }}</span></template>
          <template #type="{ row }">
            <span class="rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-primary-700">
              {{ DONOR_TYPE_LABELS[asDonor(row).type] }}
            </span>
          </template>
          <template #contact="{ row }"><span class="text-sm text-neutral-600">{{ asDonor(row).contact }}</span></template>
          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                asDonor(row).is_active
                  ? 'border-success-br bg-success-bg text-success'
                  : 'border-neutral-200 bg-neutral-100 text-neutral-500',
              ]"
            >
              {{ asDonor(row).is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </template>
          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <AppButton variant="ghost" size="sm" @click="router.push(`/donors/${asDonor(row).id}`)"><Eye /> Ver</AppButton>
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openEdit(asDonor(row))"><Pencil /></AppButton>
              </RoleGate>
              <RoleGate :roles="[...DELETE_ROLES]">
                <AppButton v-if="asDonor(row).is_active" variant="ghost" size="sm" class="text-danger" @click="askDeactivate(asDonor(row))">
                  <Ban />
                </AppButton>
              </RoleGate>
            </div>
          </template>
          <template #empty>
            <EmptyState
              title="Sin donantes"
              :message="hasFilters ? 'No hay donantes que coincidan con los filtros.' : 'Aún no se han registrado donantes.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Registrar donante</AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong></span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>

    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar donante' : 'Nuevo donante'"
      max-width="max-w-[560px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="do-name">
          <input id="do-name" v-model="form.name" class="control" placeholder="Nombre o razón social" />
        </FormField>
        <SelectField v-model="form.type" label="Tipo" required :options="typeFormOptions" :error="errors.type" input-id="do-type" />
        <FormField label="Contacto" required :error="errors.contact" input-id="do-contact" hint="Teléfono, correo o persona de contacto (obligatorio).">
          <input id="do-contact" v-model="form.contact" class="control" placeholder="Ej. 310 000 0000 / correo@…" />
        </FormField>
        <FormField label="NIT / Documento" :error="errors.tax_id" input-id="do-tax" hint="Opcional">
          <input id="do-tax" v-model="form.tax_id" class="control" placeholder="Ej. 900123456-7" />
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear donante' }}
        </AppButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmOpen"
      tone="warning"
      title="Desactivar donante"
      :message="target ? `“${target.name}” quedará inactivo. Se conserva su histórico de donaciones.` : ''"
      confirm-label="Desactivar"
      @confirm="confirmDeactivate"
      @close="confirmOpen = false"
    />
  </section>
</template>
