<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  UserPlus, Power, KeyRound, SearchX, RotateCcw, ChevronLeft, ChevronRight,
  Copy, Check, RefreshCw,
} from '@lucide/vue'
import { useUsersList, useUserMutations } from '@/composables/useUsers'
import { useAuthStore } from '@/stores/auth'
import { ROLE_LABELS } from '@/utils/constants'
import { ROLE_OPTIONS } from '@/types/user.types'
import type { RegisterUserPayload, UserListItem, UsersListParams } from '@/types/user.types'
import type { Role } from '@/types/auth.types'
import { registerUserSchema } from '@/schemas/user.schema'
import { validate } from '@/utils/validation'
import { apiErrorMessage } from '@/utils/apiError'
import PageHeader from '@/components/ui/PageHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FormField from '@/components/form/FormField.vue'
import SelectField from '@/components/form/SelectField.vue'

const PAGE_SIZE = 20
const auth = useAuthStore()

// --- Filtros + listado --------------------------------------------------------
const roleFilter = ref('')
const activeFilter = ref('')
const page = ref(1)

watch([roleFilter, activeFilter], () => {
  page.value = 1
})

const params = computed<UsersListParams>(() => ({
  page: page.value,
  per_page: PAGE_SIZE,
  ...(roleFilter.value ? { role: roleFilter.value as Role } : {}),
  ...(activeFilter.value ? { is_active: activeFilter.value === 'true' } : {}),
}))

const { data, isLoading, isFetching, isError, refetch } = useUsersList(params)
const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const hasFilters = computed(() => !!(roleFilter.value || activeFilter.value))

const roleFilterOptions = [{ value: '', label: 'Todos los roles' }, ...ROLE_OPTIONS]
const activeFilterOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
]
const roleFormOptions = [{ value: '', label: 'Selecciona el rol…' }, ...ROLE_OPTIONS]

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Correo' },
  { key: 'role', label: 'Rol' },
  { key: 'is_active', label: 'Estado', align: 'center' as const },
  { key: 'last_login_at', label: 'Último acceso' },
  { key: 'actions', label: '', align: 'right' as const },
]

const asUser = (r: unknown) => r as UserListItem
function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function clearFilters() {
  roleFilter.value = ''
  activeFilter.value = ''
}
function fmtDateTime(s: string | null) {
  if (!s) return 'Nunca'
  return new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

// --- Mutaciones ---------------------------------------------------------------
const { register, setActive, resetPassword } = useUserMutations()

// --- Modal registrar ----------------------------------------------------------
const modalOpen = ref(false)
const errors = ref<Record<string, string>>({})
const saving = computed(() => register.isPending.value)
function blankForm() {
  return { name: '', email: '', role: '', password: '' }
}
const form = ref(blankForm())

function openCreate() {
  form.value = blankForm()
  errors.value = {}
  modalOpen.value = true
}
function generatePassword() {
  form.value.password = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
async function submit() {
  const res = validate(registerUserSchema, { ...form.value })
  if (!res.ok) {
    errors.value = res.errors
    return
  }
  errors.value = {}
  try {
    await register.mutateAsync(res.data as RegisterUserPayload)
    toast.success(`Usuario ${res.data.email} creado. Deberá cambiar la contraseña al ingresar.`)
    modalOpen.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'No se pudo crear el usuario. ¿El correo ya existe?'))
  }
}

// --- Activar / desactivar -----------------------------------------------------
async function toggleActive(u: UserListItem) {
  if (u.id === auth.user?.id) {
    toast.error('No puedes desactivar tu propia cuenta.')
    return
  }
  try {
    await setActive.mutateAsync({ id: u.id, isActive: !u.is_active })
    toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Resetear contraseña ------------------------------------------------------
const resetConfirmOpen = ref(false)
const resetTarget = ref<UserListItem | null>(null)
const resetResultOpen = ref(false)
const resetPwd = ref('')
const copied = ref(false)
const resetting = computed(() => resetPassword.isPending.value)

function askReset(u: UserListItem) {
  resetTarget.value = u
  resetConfirmOpen.value = true
}
async function confirmReset() {
  if (!resetTarget.value) return
  try {
    const result = await resetPassword.mutateAsync(resetTarget.value.id)
    resetPwd.value = result.temporary_password
    copied.value = false
    resetConfirmOpen.value = false
    resetResultOpen.value = true
  } catch (e) {
    toast.error(apiErrorMessage(e))
    resetConfirmOpen.value = false
  }
}
async function copyPwd() {
  try {
    await navigator.clipboard.writeText(resetPwd.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    toast.error('No se pudo copiar al portapapeles')
  }
}
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Usuarios"
      crumb="Administración"
      :subtitle="total ? `${total} ${total === 1 ? 'usuario' : 'usuarios'} del sistema` : 'Gestión de cuentas y roles'"
    >
      <template #actions>
        <AppButton @click="openCreate"><UserPlus /> Registrar usuario</AppButton>
      </template>
    </PageHeader>

    <!-- Filtros -->
    <div class="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-2">
      <SelectField v-model="roleFilter" :options="roleFilterOptions" />
      <SelectField v-model="activeFilter" :options="activeFilterOptions" />
    </div>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los usuarios.</p>
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
        <DataTable :columns="columns" :rows="rows" row-key="id" min-width="900px">
          <template #name="{ row }">
            <div>
              <p class="font-semibold text-neutral-900">
                {{ asUser(row).name }}
                <span v-if="asUser(row).id === auth.user?.id" class="ml-1 text-xs font-normal text-neutral-400">(tú)</span>
              </p>
              <p v-if="asUser(row).password_must_change" class="text-xs text-warning">Contraseña temporal pendiente</p>
            </div>
          </template>

          <template #email="{ row }"><span class="text-neutral-600">{{ asUser(row).email }}</span></template>

          <template #role="{ row }">{{ ROLE_LABELS[asUser(row).role] }}</template>

          <template #is_active="{ row }">
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                asUser(row).is_active
                  ? 'border-success-br bg-success-bg text-success'
                  : 'border-neutral-200 bg-neutral-100 text-neutral-500',
              ]"
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current" />
              {{ asUser(row).is_active ? 'Activo' : 'Inactivo' }}
            </span>
          </template>

          <template #last_login_at="{ row }">
            <span class="text-sm text-neutral-600">{{ fmtDateTime(asUser(row).last_login_at) }}</span>
          </template>

          <template #actions="{ row }">
            <div class="flex justify-end gap-1">
              <AppButton variant="ghost" size="sm" @click="askReset(asUser(row))">
                <KeyRound /> Resetear
              </AppButton>
              <AppButton
                variant="ghost"
                size="sm"
                :class="asUser(row).is_active ? 'text-danger' : 'text-success'"
                :disabled="asUser(row).id === auth.user?.id"
                @click="toggleActive(asUser(row))"
              >
                <Power /> {{ asUser(row).is_active ? 'Desactivar' : 'Activar' }}
              </AppButton>
            </div>
          </template>

          <template #empty>
            <EmptyState
              title="Sin usuarios"
              :message="hasFilters ? 'No hay usuarios que coincidan con los filtros.' : 'Aún no hay usuarios registrados.'"
            >
              <template #icon><SearchX /></template>
              <template #action>
                <AppButton v-if="hasFilters" variant="outline" size="sm" @click="clearFilters">
                  <RotateCcw /> Limpiar filtros
                </AppButton>
                <AppButton v-else size="sm" @click="openCreate"><UserPlus /> Registrar usuario</AppButton>
              </template>
            </EmptyState>
          </template>
        </DataTable>
      </div>

      <!-- Paginación -->
      <div v-if="total > 0" class="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-600">
        <span>Mostrando <strong>{{ rangeFrom }}–{{ rangeTo }}</strong> de <strong>{{ total }}</strong></span>
        <div class="flex items-center gap-2">
          <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)"><ChevronLeft /></AppButton>
          <span class="px-1">Página {{ page }} de {{ totalPages }}</span>
          <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)"><ChevronRight /></AppButton>
        </div>
      </div>
    </template>

    <!-- Modal registrar -->
    <BaseModal :open="modalOpen" title="Registrar usuario" max-width="max-w-[560px]" @close="modalOpen = false">
      <form class="space-y-4" @submit.prevent="submit">
        <FormField label="Nombre completo" required :error="errors.name" input-id="us-name">
          <input id="us-name" v-model="form.name" class="control" placeholder="Nombre y apellidos" />
        </FormField>
        <FormField label="Correo" required :error="errors.email" input-id="us-email">
          <input id="us-email" v-model="form.email" type="email" class="control" placeholder="usuario@monteria.gov.co" />
        </FormField>
        <SelectField
          v-model="form.role"
          label="Rol"
          required
          :options="roleFormOptions"
          :error="errors.role"
          input-id="us-role"
        />
        <FormField
          label="Contraseña temporal"
          required
          :error="errors.password"
          input-id="us-pwd"
          hint="El usuario deberá cambiarla en su primer ingreso."
        >
          <div class="flex gap-2">
            <input id="us-pwd" v-model="form.password" class="control" placeholder="Mínimo 8 caracteres" />
            <AppButton type="button" variant="outline" @click="generatePassword"><RefreshCw /> Generar</AppButton>
          </div>
        </FormField>
      </form>
      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">{{ saving ? 'Creando…' : 'Crear usuario' }}</AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar reseteo -->
    <ConfirmDialog
      :open="resetConfirmOpen"
      tone="warning"
      title="Resetear contraseña"
      :message="resetTarget ? `Se generará una contraseña temporal para “${resetTarget.name}”. Deberá cambiarla al ingresar.` : ''"
      :confirm-label="resetting ? 'Generando…' : 'Resetear'"
      @confirm="confirmReset"
      @close="resetConfirmOpen = false"
    />

    <!-- Resultado del reseteo: contraseña temporal (se muestra una sola vez) -->
    <BaseModal :open="resetResultOpen" title="Contraseña temporal generada" max-width="max-w-[460px]" @close="resetResultOpen = false">
      <div class="space-y-3">
        <p class="text-sm text-neutral-600">
          Comparte esta contraseña con el usuario por un canal seguro. <strong>No se volverá a mostrar.</strong>
        </p>
        <div class="flex items-center justify-between gap-3 rounded-md border border-neutral-300 bg-neutral-50 p-3">
          <code class="font-mono text-base text-neutral-900">{{ resetPwd }}</code>
          <AppButton variant="outline" size="sm" @click="copyPwd">
            <Check v-if="copied" /> <Copy v-else /> {{ copied ? 'Copiado' : 'Copiar' }}
          </AppButton>
        </div>
      </div>
      <template #footer>
        <AppButton @click="resetResultOpen = false">Entendido</AppButton>
      </template>
    </BaseModal>
  </section>
</template>
