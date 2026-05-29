<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Plus, Pencil, Ban, RotateCw, SearchX, RotateCcw } from '@lucide/vue'
import { useResourceTypes, useResourceTypeMutations } from '@/composables/useResourceTypes'
import {
  RESOURCE_CATEGORY_OPTIONS, RESOURCE_CATEGORY_LABELS,
} from '@/types/inventory.types'
import type {
  ResourceCategory, ResourceType, ResourceTypeListParams, ResourceTypePayload,
} from '@/types/inventory.types'
import { resourceTypeSchema } from '@/schemas/resourceType.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

const categoryFilter = ref('')
const statusFilter = ref('')
const params = computed<ResourceTypeListParams>(() => ({
  ...(categoryFilter.value ? { category: categoryFilter.value as ResourceCategory } : {}),
  ...(statusFilter.value ? { is_active: statusFilter.value === 'true' } : {}),
}))
const { data, isLoading, isError, refetch, isFetching } = useResourceTypes(params)
const rows = computed(() => data.value ?? [])
const hasFilters = computed(() => !!(categoryFilter.value || statusFilter.value))

const categoryFilterOptions = [{ value: '', label: 'Todas las categorías' }, ...RESOURCE_CATEGORY_OPTIONS]
const categoryFormOptions = [{ value: '', label: 'Selecciona la categoría…' }, ...RESOURCE_CATEGORY_OPTIONS]
const statusFilterOptions = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]

const columns = [
  { key: 'name', label: 'Recurso' },
  { key: 'category', label: 'Categoría' },
  { key: 'unit', label: 'Unidad' },
  { key: 'weight', label: 'Peso unitario', align: 'right' as const },
  { key: 'status', label: 'Estado', align: 'center' as const },
  { key: 'actions', label: '', align: 'right' as const },
]
const asRt = (r: unknown) => r as ResourceType

function clearFilters() {
  categoryFilter.value = ''
  statusFilter.value = ''
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, deactivate } = useResourceTypeMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)
const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return { name: '', category: '', unit_of_measure: '', unit_weight_kg: '' }
}
const form = ref(blankForm())

function openCreate() {
  editId.value = null
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function openEdit(rt: ResourceType) {
  editId.value = rt.id
  form.value = {
    name: rt.name,
    category: rt.category,
    unit_of_measure: rt.unit_of_measure,
    unit_weight_kg: String(rt.unit_weight_kg),
  }
  errors.value = {}
  modalOpen.value = true
}
async function submit() {
  const res = validate(resourceTypeSchema, { ...form.value })
  if (!res.ok) {
    errors.value = res.errors
    return
  }
  errors.value = {}
  const payload: ResourceTypePayload = res.data
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Recurso actualizado' : 'Recurso creado')
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo guardar. ¿El nombre ya existe?'))
  }
}

async function reactivate(rt: ResourceType) {
  try {
    await update.mutateAsync({ id: rt.id, payload: { is_active: true } })
    toast.success('Recurso reactivado')
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Desactivar (soft delete, HU-14 CA4) --------------------------------------
const confirmOpen = ref(false)
const target = ref<ResourceType | null>(null)
function askDeactivate(rt: ResourceType) {
  target.value = rt
  confirmOpen.value = true
}
async function confirmDeactivate() {
  if (!target.value) return
  try {
    await deactivate.mutateAsync(target.value.id)
    toast.success('Recurso desactivado')
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
    <PageHeader title="Tipos de recurso" crumb="Logística" subtitle="Catálogo de insumos de ayuda humanitaria">
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Nuevo recurso</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SelectField v-model="categoryFilter" :options="categoryFilterOptions" />
      <SelectField v-model="statusFilter" :options="statusFilterOptions" />
    </div>

    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los recursos.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()"><RotateCcw /> Reintentar</AppButton>
    </div>

    <div v-else-if="isLoading" class="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <SkeletonBlock v-for="n in 6" :key="n" height="44px" />
    </div>

    <div v-else :class="{ 'opacity-60 transition-opacity': isFetching }">
      <DataTable :columns="columns" :rows="rows" row-key="id" min-width="760px">
        <template #name="{ row }"><span class="font-medium text-neutral-900">{{ asRt(row).name }}</span></template>
        <template #category="{ row }">{{ RESOURCE_CATEGORY_LABELS[asRt(row).category] }}</template>
        <template #unit="{ row }"><span class="text-neutral-600">{{ asRt(row).unit_of_measure }}</span></template>
        <template #weight="{ row }"><span class="font-mono text-xs">{{ asRt(row).unit_weight_kg }} kg</span></template>
        <template #status="{ row }">
          <span
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
              asRt(row).is_active
                ? 'border-success-br bg-success-bg text-success'
                : 'border-neutral-200 bg-neutral-100 text-neutral-500',
            ]"
          >
            {{ asRt(row).is_active ? 'Activo' : 'Inactivo' }}
          </span>
        </template>
        <template #actions="{ row }">
          <RoleGate :roles="[...EDIT_ROLES]">
            <div class="flex justify-end gap-1">
              <AppButton variant="ghost" size="sm" @click="openEdit(asRt(row))"><Pencil /></AppButton>
              <AppButton
                v-if="asRt(row).is_active"
                variant="ghost"
                size="sm"
                class="text-danger"
                @click="askDeactivate(asRt(row))"
              >
                <Ban /> Desactivar
              </AppButton>
              <AppButton v-else variant="ghost" size="sm" class="text-success" @click="reactivate(asRt(row))">
                <RotateCw /> Reactivar
              </AppButton>
            </div>
          </RoleGate>
        </template>
        <template #empty>
          <EmptyState
            title="Sin recursos"
            :message="hasFilters ? 'No hay recursos que coincidan con los filtros.' : 'Aún no hay tipos de recurso en el catálogo.'"
          >
            <template #icon><SearchX /></template>
            <template #action>
              <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters"><RotateCcw /> Limpiar filtros</AppButton>
              <RoleGate v-else :roles="[...EDIT_ROLES]">
                <AppButton size="sm" @click="openCreate"><Plus /> Nuevo recurso</AppButton>
              </RoleGate>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar recurso' : 'Nuevo recurso'"
      max-width="max-w-[520px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="rt-name">
          <input id="rt-name" v-model="form.name" class="control" placeholder="Ej. Kit alimentario" />
        </FormField>
        <SelectField v-model="form.category" label="Categoría" required :options="categoryFormOptions" :error="errors.category" input-id="rt-cat" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Unidad de medida" required :error="errors.unit_of_measure" input-id="rt-unit" hint="Ej. unidad, kg, caja">
            <input id="rt-unit" v-model="form.unit_of_measure" class="control" placeholder="unidad" />
          </FormField>
          <FormField label="Peso unitario (kg)" required :error="errors.unit_weight_kg" input-id="rt-weight">
            <input id="rt-weight" v-model="form.unit_weight_kg" type="number" min="0" step="any" class="control" placeholder="0" />
          </FormField>
        </div>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear recurso' }}
        </AppButton>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmOpen"
      tone="warning"
      title="Desactivar recurso"
      :message="target ? `“${target.name}” quedará inactivo (no se elimina, para preservar el histórico). Podrás reactivarlo luego.` : ''"
      confirm-label="Desactivar"
      @confirm="confirmDeactivate"
      @close="confirmOpen = false"
    />
  </section>
</template>
