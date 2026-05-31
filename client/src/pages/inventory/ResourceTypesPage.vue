<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Power, RotateCw, SearchX, RotateCcw, ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useResourceTypes, useResourceTypeMutations } from '@/composables/useResourceTypes'
import {
  RESOURCE_CATEGORY_OPTIONS, RESOURCE_CATEGORY_LABELS, RESOURCE_CATEGORY_BADGE,
} from '@/types/resourceType.types'
import type {
  ResourceCategory, ResourceType, ResourceTypeListParams, ResourceTypePayload,
} from '@/types/resourceType.types'
import { resourceTypeSchema } from '@/schemas/resourceType.schema'
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
// HU-14: gestión del catálogo restringida a logística y registro de donaciones.
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA', 'REGISTRADOR_DONACIONES'] as const

// --- Filtros + listado --------------------------------------------------------
const search = ref('')
const categoryFilter = ref('')
// HU-14 CA: por defecto solo activos; el usuario puede incluir los inactivos.
const showInactive = ref(false)
const page = ref(1)

const params = computed<ResourceTypeListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(search.value ? { search: search.value } : {}),
  ...(categoryFilter.value ? { category: categoryFilter.value as ResourceCategory } : {}),
  // is_active=true filtra solo activos; sin el parámetro el backend devuelve todos.
  ...(showInactive.value ? {} : { is_active: true }),
}))

const { data, isLoading, isFetching, isError, refetch } = useResourceTypes(params)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(search.value || categoryFilter.value || showInactive.value))

const categoryFilterOptions = computed(() => [
  { value: '', label: 'Todas las categorías' },
  ...RESOURCE_CATEGORY_OPTIONS,
])
const categoryFormOptions = [
  { value: '', label: 'Selecciona la categoría…' },
  ...RESOURCE_CATEGORY_OPTIONS,
]

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'category', label: 'Categoría' },
  { key: 'unit', label: 'Unidad' },
  { key: 'weight', label: 'Peso unit. (kg)', align: 'center' as const },
  { key: 'status', label: 'Estado' },
  { key: 'actions', label: '', align: 'right' as const },
]

const asResourceType = (r: unknown) => r as ResourceType
const formatKg = (n: number) =>
  Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  search.value = ''
  categoryFilter.value = ''
  showInactive.value = false
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, remove } = useResourceTypeMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)

const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    name: '',
    category: '' as ResourceCategory | '',
    unit_of_measure: '',
    unit_weight_kg: '',
  }
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
  const res = validate(resourceTypeSchema, {
    name: form.value.name,
    category: form.value.category,
    unit_of_measure: form.value.unit_of_measure,
    unit_weight_kg: form.value.unit_weight_kg,
  })
  errors.value = res.ok ? {} : { ...res.errors }
  if (!res.ok) return

  const payload: ResourceTypePayload = {
    name: res.data.name,
    category: res.data.category,
    unit_of_measure: res.data.unit_of_measure,
    unit_weight_kg: res.data.unit_weight_kg,
  }
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Tipo de recurso actualizado' : 'Tipo de recurso creado')
    modalOpen.value = false
  } catch (e) {
    // HU-14 CA2: el backend devuelve SH409 (HTTP 409) si ya existe un tipo con la
    // misma combinación (name, category). Mostramos un mensaje claro junto al campo.
    if (apiErrorStatus(e) === 409) {
      errors.value = {
        ...errors.value,
        name: 'Ya existe un tipo de recurso con ese nombre en esta categoría.',
      }
      toast.error('Ya existe un tipo de recurso con ese nombre en esta categoría.')
      return
    }
    toast.error(apiErrorMessage(e))
  }
}

// --- Activar / desactivar (soft-delete, sin borrado físico — HU-14 CA4) --------
const confirmOpen = ref(false)
const target = ref<ResourceType | null>(null)
function askDeactivate(rt: ResourceType) {
  target.value = rt
  confirmOpen.value = true
}
async function confirmDeactivate() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Tipo de recurso desactivado')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo desactivar el tipo de recurso.'))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}

// Reactivar: PUT con is_active=true (no hay endpoint específico, se usa el update).
async function reactivate(rt: ResourceType) {
  try {
    await update.mutateAsync({ id: rt.id, payload: { is_active: true } })
    toast.success('Tipo de recurso reactivado')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo reactivar el tipo de recurso.'))
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Tipos de recurso"
      crumb="Logística"
      :subtitle="total ? `${total} ${total === 1 ? 'tipo registrado' : 'tipos registrados'}` : 'Catálogo de recursos para inventario y donaciones'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Nuevo tipo</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3">
      <SearchInput v-model="search" placeholder="Buscar por nombre…" />
      <SelectField v-model="categoryFilter" :options="categoryFilterOptions" />
      <label class="flex items-center gap-2 text-sm text-neutral-700">
        <input v-model="showInactive" type="checkbox" class="h-4 w-4 rounded border-neutral-300" />
        Mostrar inactivos
      </label>
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los tipos de recurso.</p>
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
            <!-- HU-14 CA: los inactivos se muestran atenuados. -->
            <span
              class="font-semibold"
              :class="asResourceType(row).is_active ? 'text-neutral-900' : 'text-neutral-400'"
            >
              {{ asResourceType(row).name }}
            </span>
          </template>

          <template #category="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                RESOURCE_CATEGORY_BADGE[asResourceType(row).category],
                asResourceType(row).is_active ? '' : 'opacity-50',
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ RESOURCE_CATEGORY_LABELS[asResourceType(row).category] }}
            </span>
          </template>

          <template #unit="{ row }">
            <span :class="asResourceType(row).is_active ? 'text-neutral-700' : 'text-neutral-400'">
              {{ asResourceType(row).unit_of_measure }}
            </span>
          </template>

          <template #weight="{ row }">
            <span
              class="font-mono text-xs"
              :class="asResourceType(row).is_active ? 'text-neutral-700' : 'text-neutral-400'"
            >
              {{ formatKg(asResourceType(row).unit_weight_kg) }}
            </span>
          </template>

          <template #status="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
                asResourceType(row).is_active
                  ? 'text-success bg-success-bg border-success-br'
                  : 'text-neutral-500 bg-neutral-100 border-neutral-200',
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ asResourceType(row).is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <RoleGate :roles="[...EDIT_ROLES]">
                <AppButton variant="ghost" size="sm" @click="openEdit(asResourceType(row))">
                  <Pencil />
                </AppButton>
              </RoleGate>
              <RoleGate :roles="[...EDIT_ROLES]">
                <!-- HU-14 CA4: nunca borrado físico — desactivar / reactivar. -->
                <AppButton
                  v-if="asResourceType(row).is_active"
                  variant="ghost"
                  size="sm"
                  class="text-danger"
                  title="Desactivar"
                  @click="askDeactivate(asResourceType(row))"
                >
                  <Power />
                </AppButton>
                <AppButton
                  v-else
                  variant="ghost"
                  size="sm"
                  class="text-success"
                  title="Reactivar"
                  @click="reactivate(asResourceType(row))"
                >
                  <RotateCw />
                </AppButton>
              </RoleGate>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin tipos de recurso"
              :message="hasFilters ? 'No hay tipos de recurso que coincidan con los filtros.' : 'Aún no se han registrado tipos de recurso.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <RoleGate v-else :roles="[...EDIT_ROLES]">
                  <AppButton size="sm" @click="openCreate"><Plus /> Nuevo tipo</AppButton>
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
      :title="editId != null ? 'Editar tipo de recurso' : 'Nuevo tipo de recurso'"
      max-width="max-w-[560px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="rt-name">
          <input id="rt-name" v-model="form.name" class="control" placeholder="Ej. Arroz" />
        </FormField>

        <SelectField
          v-model="form.category"
          label="Categoría"
          required
          :options="categoryFormOptions"
          :error="errors.category"
          input-id="rt-category"
        />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Unidad de medida"
            required
            :error="errors.unit_of_measure"
            input-id="rt-unit"
            hint="Ej. kg, unidad, caja."
          >
            <input id="rt-unit" v-model="form.unit_of_measure" class="control" placeholder="Ej. kg" />
          </FormField>

          <FormField
            label="Peso unitario (kg)"
            required
            :error="errors.unit_weight_kg"
            input-id="rt-weight"
          >
            <input
              id="rt-weight"
              v-model="form.unit_weight_kg"
              type="number"
              min="0"
              step="0.001"
              class="control"
              placeholder="0"
            />
          </FormField>
        </div>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear tipo' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar desactivación (soft-delete) -->
    <ConfirmDialog
      :open="confirmOpen"
      title="Desactivar tipo de recurso"
      :message="target ? `¿Desactivar “${target.name}”? Dejará de aparecer en nuevos registros, pero se conserva en el histórico y podrás reactivarlo.` : ''"
      confirm-label="Desactivar"
      @confirm="confirmDeactivate"
      @close="confirmOpen = false"
    />
  </section>
</template>
