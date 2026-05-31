<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Trash2, SearchX, RotateCcw, ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useDonors, useDonorMutations } from '@/composables/useDonors'
import { DONOR_TYPE_OPTIONS, DONOR_TYPE_LABELS } from '@/types/donor.types'
import type { Donor, DonorListParams, DonorPayload, DonorType } from '@/types/donor.types'
import { donorSchema } from '@/schemas/donor.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
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

const PAGE_SIZE = 20
// HU-18: gestión de donantes restringida a admin y registro de donaciones.
const EDIT_ROLES = ['ADMIN', 'REGISTRADOR_DONACIONES'] as const

// --- Filtros + listado --------------------------------------------------------
const search = ref('')
const typeFilter = ref('')
// Por defecto solo activos; el usuario puede incluir los inactivos.
const showInactive = ref(false)
const page = ref(1)

const params = computed<DonorListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(search.value ? { search: search.value } : {}),
  ...(typeFilter.value ? { type: typeFilter.value as DonorType } : {}),
  ...(showInactive.value ? {} : { is_active: true }),
}))

const { data, isLoading, isFetching, isError, refetch } = useDonors(params)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(search.value || typeFilter.value || showInactive.value))

const typeFilterOptions = computed(() => [
  { value: '', label: 'Todos los tipos' },
  ...DONOR_TYPE_OPTIONS,
])
const typeFormOptions = [
  { value: '', label: 'Selecciona el tipo…' },
  ...DONOR_TYPE_OPTIONS,
]

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'type', label: 'Tipo' },
  { key: 'contact', label: 'Contacto' },
  { key: 'tax_id', label: 'Identif. tributaria' },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '', align: 'right' as const },
]

const asDonor = (r: unknown) => r as Donor

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  search.value = ''
  typeFilter.value = ''
  showInactive.value = false
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, remove } = useDonorMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)

const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    name: '',
    type: '' as DonorType | '',
    contact: '',
    tax_id: '',
  }
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
  form.value = {
    name: d.name,
    type: d.type,
    contact: d.contact,
    tax_id: d.tax_id ?? '',
  }
  errors.value = {}
  modalOpen.value = true
}

async function submit() {
  const res = validate(donorSchema, {
    name: form.value.name,
    type: form.value.type,
    contact: form.value.contact,
    tax_id: form.value.tax_id,
  })
  errors.value = res.ok ? {} : { ...res.errors }
  if (!res.ok) return

  const payload: DonorPayload = {
    name: res.data.name,
    type: res.data.type,
    contact: res.data.contact,
    // tax_id es opcional: enviamos null cuando queda vacío.
    tax_id: res.data.tax_id ? res.data.tax_id : null,
  }
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Donante actualizado' : 'Donante registrado')
    modalOpen.value = false
  } catch (e) {
    // HU-18 CA: el backend devuelve SH409 (HTTP 409) si ya existe un donante con
    // la misma combinación (name, type). Resaltamos el conflicto en ambos campos.
    if (apiErrorStatus(e) === 409) {
      const msg = 'Ya existe un donante con ese nombre y tipo.'
      errors.value = { ...errors.value, name: msg, type: msg }
      toast.error(msg)
      return
    }
    toast.error(apiErrorMessage(e))
  }
}

// --- Eliminar (soft-delete si tiene donaciones, sin error al usuario) ----------
const confirmOpen = ref(false)
const target = ref<Donor | null>(null)
function askDelete(d: Donor) {
  target.value = d
  confirmOpen.value = true
}
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Donante eliminado')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo eliminar el donante.'))
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
      crumb="Donaciones"
      :subtitle="total ? `${total} ${total === 1 ? 'donante registrado' : 'donantes registrados'}` : 'Registro de donantes de la organización'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Nuevo donante</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SearchInput v-model="search" placeholder="Buscar por nombre o contacto…" />
      <SelectField v-model="typeFilter" :options="typeFilterOptions" />
      <label class="flex items-center gap-2 text-sm text-neutral-700">
        <input v-model="showInactive" type="checkbox" class="h-4 w-4 rounded border-neutral-300" />
        Mostrar inactivos
      </label>
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los donantes.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 8" :key="n" height="44px" />
    </div>

    <!-- Datos -->
    <template v-else>
      <div :class="{ 'opacity-60 transition-opacity': isFetching }">
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="820px">
          <template #name="{ row }">
            <!-- Los inactivos se muestran atenuados. -->
            <span
              class="font-semibold"
              :class="asDonor(row).is_active ? 'text-neutral-900' : 'text-neutral-400'"
            >
              {{ asDonor(row).name }}
            </span>
          </template>

          <template #type="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-neutral-700',
                asDonor(row).is_active ? '' : 'opacity-50',
              ]"
            >
              {{ DONOR_TYPE_LABELS[asDonor(row).type] }}
            </span>
          </template>

          <template #contact="{ row }">
            <span :class="asDonor(row).is_active ? 'text-neutral-700' : 'text-neutral-400'">
              {{ asDonor(row).contact }}
            </span>
          </template>

          <template #tax_id="{ row }">
            <span
              class="font-mono text-xs"
              :class="asDonor(row).is_active ? 'text-neutral-700' : 'text-neutral-400'"
            >
              {{ asDonor(row).tax_id || '—' }}
            </span>
          </template>

          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                asDonor(row).is_active
                  ? 'text-success bg-success-bg border-success-br'
                  : 'text-neutral-500 bg-neutral-100 border-neutral-200',
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ asDonor(row).is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openEdit(asDonor(row))">
                  <Pencil />
                </AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <!-- Soft-delete: si el donante tiene donaciones se desactiva. -->
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="text-danger"
                  title="Eliminar"
                  @click="askDelete(asDonor(row))"
                >
                  <Trash2 />
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
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Nuevo donante</AppButton>
                </RoleGate>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <!-- Paginación -->
      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>
          Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong>
        </span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
            <ChevronLeft />
          </AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
            <ChevronRight />
          </AppButton>
        </div>
      </div>
    </template>

    <!-- Modal crear / editar -->
    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar donante' : 'Nuevo donante'"
      max-width="max-w-[560px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="donor-name">
          <input id="donor-name" v-model="form.name" class="control" placeholder="Ej. Alcaldía de Medellín" />
        </FormField>

        <SelectField
          v-model="form.type"
          label="Tipo de donante"
          required
          :options="typeFormOptions"
          :error="errors.type"
          input-id="donor-type"
        />

        <FormField
          label="Contacto"
          required
          :error="errors.contact"
          input-id="donor-contact"
          hint="Teléfono o correo electrónico."
        >
          <input id="donor-contact" v-model="form.contact" class="control" placeholder="Ej. 3001234567 o correo@dominio.com" />
        </FormField>

        <FormField
          label="Identificación tributaria"
          :error="errors.tax_id"
          input-id="donor-tax-id"
          hint="Opcional. NIT o documento."
        >
          <input id="donor-tax-id" v-model="form.tax_id" class="control" placeholder="Ej. 900123456-7" />
        </FormField>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Registrar donante' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación (soft-delete si tiene donaciones) -->
    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar donante"
      :message="target ? `¿Eliminar “${target.name}”? Si tiene donaciones asociadas se desactivará en lugar de borrarse, conservando el histórico.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
