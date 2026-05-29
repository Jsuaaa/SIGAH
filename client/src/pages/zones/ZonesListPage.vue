<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Plus, Pencil, Trash2, Eye, MapPin, Users, SearchX, RotateCcw, ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useZonesList, useZoneMutations } from '@/composables/useZones'
import { RISK_LEVEL_OPTIONS } from '@/types/zone.types'
import type { Zone, ZoneListParams, ZonePayload } from '@/types/zone.types'
import { zoneSchema } from '@/schemas/zone.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import RiskLevelBadge from '@/components/ui/RiskLevelBadge.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SearchInput from '@/components/form/SearchInput.vue'
import SelectField from '@/components/form/SelectField.vue'
import FormField from '@/components/form/FormField.vue'
import MapPicker from '@/components/form/MapPicker.vue'
import RoleGate from '@/components/auth/RoleGate.vue'

const router = useRouter()
const PAGE_SIZE = 12
const EDIT_ROLES = ['ADMIN', 'COORDINADOR_LOGISTICA'] as const

// --- Filtros + listado --------------------------------------------------------
const search = ref('')
const riskFilter = ref('')
const page = ref(1)

const params = computed<ZoneListParams>(() => ({
  page: page.value,
  limit: PAGE_SIZE,
  ...(search.value ? { search: search.value } : {}),
  ...(riskFilter.value ? { risk_level: riskFilter.value as Zone['risk_level'] } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useZonesList(params)
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)
const hasFilters = computed(() => !!(search.value || riskFilter.value))

const riskFilterOptions = [{ value: '', label: 'Todos los niveles de riesgo' }, ...RISK_LEVEL_OPTIONS]
const riskFormOptions = [{ value: '', label: 'Selecciona el nivel de riesgo…' }, ...RISK_LEVEL_OPTIONS]

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  search.value = ''
  riskFilter.value = ''
}

// --- Modal crear / editar -----------------------------------------------------
const { create, update, remove } = useZoneMutations()
const saving = computed(() => create.isPending.value || update.isPending.value)

const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return {
    name: '',
    risk_level: '',
    estimated_population: '',
    latitude: null as number | null,
    longitude: null as number | null,
  }
}
const form = ref(blankForm())

function openCreate() {
  editId.value = null
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function openEdit(zone: Zone) {
  editId.value = zone.id
  form.value = {
    name: zone.name,
    risk_level: zone.risk_level,
    estimated_population: String(zone.estimated_population),
    latitude: zone.latitude,
    longitude: zone.longitude,
  }
  errors.value = {}
  modalOpen.value = true
}

async function submit() {
  const res = validate(zoneSchema, {
    name: form.value.name,
    risk_level: form.value.risk_level,
    estimated_population: form.value.estimated_population,
  })
  const errs: Record<string, string> = res.ok ? {} : { ...res.errors }
  if (form.value.latitude == null || form.value.longitude == null) {
    errs.location = 'Ubica la zona en el mapa (toca para colocar el marcador).'
  }
  errors.value = errs
  if (!res.ok || errs.location) return

  const payload: ZonePayload = {
    name: res.data.name,
    risk_level: res.data.risk_level,
    estimated_population: res.data.estimated_population,
    latitude: form.value.latitude!,
    longitude: form.value.longitude!,
  }
  try {
    if (editId.value != null) await update.mutateAsync({ id: editId.value, payload })
    else await create.mutateAsync(payload)
    toast.success(editId.value != null ? 'Zona actualizada' : 'Zona creada')
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Eliminar -----------------------------------------------------------------
const confirmOpen = ref(false)
const target = ref<Zone | null>(null)
function askDelete(zone: Zone) {
  target.value = zone
  confirmOpen.value = true
}
async function confirmDelete() {
  if (!target.value) return
  try {
    await remove.mutateAsync(target.value.id)
    toast.success('Zona eliminada')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo eliminar: la zona puede tener refugios o bodegas asociados.'))
  } finally {
    confirmOpen.value = false
    target.value = null
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Zonas"
      crumb="Censo"
      :subtitle="total ? `${total} ${total === 1 ? 'zona registrada' : 'zonas registradas'}` : 'Territorios afectados y su nivel de riesgo'"
    >
      <template #actions>
        <RoleGate :roles="[...EDIT_ROLES]">
          <AppButton @click="openCreate"><Plus /> Agregar zona</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SearchInput v-model="search" placeholder="Buscar por nombre…" />
      <SelectField v-model="riskFilter" :options="riskFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar las zonas.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SkeletonBlock v-for="n in 6" :key="n" height="150px" rounded="12px" />
    </div>

    <!-- Vacío -->
    <div v-else-if="!rows.length" class="rounded-lg border border-neutral-200 bg-white">
      <EmptyState
        title="Sin zonas"
        :message="hasFilters ? 'No hay zonas que coincidan con los filtros.' : 'Aún no se han registrado zonas geográficas.'"
      >
        <template #icon><SearchX /></template>
        <template #action>
          <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
            <RotateCcw /> Limpiar filtros
          </AppButton>
          <RoleGate v-else :roles="[...EDIT_ROLES]">
            <AppButton size="sm" @click="openCreate"><Plus /> Agregar zona</AppButton>
          </RoleGate>
        </template>
      </EmptyState>
    </div>

    <!-- Grid de zonas -->
    <template v-else>
      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        :class="{ 'opacity-60 transition-opacity': isFetching }"
      >
        <article
          v-for="zone in rows"
          :key="zone.id"
          class="flex flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-xs"
        >
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-lg font-semibold text-neutral-900">{{ zone.name }}</h3>
            <RiskLevelBadge :level="zone.risk_level" />
          </div>

          <div class="mt-3 flex items-center gap-2 text-neutral-700">
            <Users class="h-4 w-4 text-neutral-400" />
            <span class="text-2xl font-semibold">{{ Number(zone.estimated_population).toLocaleString('es-CO') }}</span>
            <span class="text-sm text-neutral-500">hab. estimados</span>
          </div>

          <p class="mt-1 flex items-center gap-1.5 font-mono text-xs text-neutral-400">
            <MapPin class="h-3.5 w-3.5" /> {{ zone.latitude.toFixed(4) }}, {{ zone.longitude.toFixed(4) }}
          </p>

          <div class="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
            <AppButton variant="ghost" size="sm" @click="router.push(`/zones/${zone.id}`)">
              <Eye /> Ver
            </AppButton>
            <RoleGate :roles="[...EDIT_ROLES]">
              <AppButton variant="ghost" size="sm" @click="openEdit(zone)"><Pencil /> Editar</AppButton>
            </RoleGate>
            <RoleGate :roles="[...EDIT_ROLES]">
              <AppButton variant="ghost" size="sm" class="text-danger" @click="askDelete(zone)">
                <Trash2 /> Eliminar
              </AppButton>
            </RoleGate>
          </div>
        </article>
      </div>

      <!-- Paginación -->
      <div v-if="totalPages > 1" class="flex items-center justify-end gap-2 text-sm text-neutral-600">
        <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
          <ChevronLeft />
        </AppButton>
        <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
        <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
          <ChevronRight />
        </AppButton>
      </div>
    </template>

    <!-- Modal crear / editar -->
    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar zona' : 'Nueva zona'"
      max-width="max-w-[560px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre" required :error="errors.name" input-id="zone-name">
          <input id="zone-name" v-model="form.name" class="control" placeholder="Ej. Cantaclaro" />
        </FormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            v-model="form.risk_level"
            label="Nivel de riesgo"
            required
            :options="riskFormOptions"
            :error="errors.risk_level"
            input-id="zone-risk"
          />
          <FormField
            label="Población estimada"
            required
            :error="errors.estimated_population"
            input-id="zone-pop"
          >
            <input id="zone-pop" v-model="form.estimated_population" type="number" min="0" class="control" placeholder="0" />
          </FormField>
        </div>

        <FormField
          label="Ubicación"
          required
          :error="errors.location"
          hint="Toca el mapa para colocar el marcador; arrástralo para ajustar."
        >
          <MapPicker
            v-model:latitude="form.latitude"
            v-model:longitude="form.longitude"
            height="260px"
          />
        </FormField>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Crear zona' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar eliminación -->
    <ConfirmDialog
      :open="confirmOpen"
      title="Eliminar zona"
      :message="target ? `¿Eliminar la zona “${target.name}”? Esta acción no se puede deshacer.` : ''"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
      @close="confirmOpen = false"
    />
  </section>
</template>
