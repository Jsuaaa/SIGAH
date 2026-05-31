<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  UserPlus, Pencil, KeyRound, Power, Users as UsersIcon, RotateCcw, Copy, Check,
  ChevronLeft, ChevronRight,
} from '@lucide/vue'
import { useUsersList, useUserMutations } from '@/composables/useUsers'
import { ROLE_LABELS, ROLE_OPTIONS } from '@/types/user.types'
import type { AdminUser, UsersListParams } from '@/types/user.types'
import type { Role } from '@/types/auth.types'
import { userRegisterSchema, userUpdateSchema } from '@/schemas/user.schema'
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
import RoleGate from '@/components/auth/RoleGate.vue'

const PAGE_SIZE = 10

// --- Listado ------------------------------------------------------------------
const page = ref(1)
const params = computed<UsersListParams>(() => ({ page: page.value, limit: PAGE_SIZE }))
const { data, isLoading, isFetching, isError, refetch } = useUsersList(params)

const rows = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.pagination.total ?? 0)
const totalPages = computed(() => data.value?.pagination.totalPages ?? 1)

function goTo(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'email', label: 'Correo' },
  { key: 'role', label: 'Rol' },
  { key: 'is_active', label: 'Estado' },
  { key: 'last_login_at', label: 'Último acceso' },
  { key: 'actions', label: '', align: 'right' as const },
]

function roleLabel(role: Role) {
  return ROLE_LABELS[role] ?? role
}

function formatLastLogin(value: string | null): string {
  if (!value) return 'Nunca'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Nunca'
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

// --- Generador de contraseña temporal ----------------------------------------
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  const cryptoObj = window.crypto
  const bytes = new Uint32Array(14)
  cryptoObj.getRandomValues(bytes)
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length]
  return out
}

// --- Modal crear / editar -----------------------------------------------------
const { register, update, resetPassword } = useUserMutations()
const saving = computed(() => register.isPending.value || update.isPending.value)

const modalOpen = ref(false)
const editId = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
function blankForm() {
  return { email: '', name: '', role: '', password: '', is_active: true }
}
const form = ref(blankForm())

function openCreate() {
  editId.value = null
  form.value = { ...blankForm(), password: generatePassword() }
  errors.value = {}
  modalOpen.value = true
}
function openEdit(user: AdminUser) {
  editId.value = user.id
  form.value = {
    email: user.email,
    name: user.name,
    role: user.role,
    password: '',
    is_active: user.is_active,
  }
  errors.value = {}
  modalOpen.value = true
}
function regeneratePassword() {
  form.value.password = generatePassword()
}

async function submit() {
  if (editId.value != null) {
    const res = validate(userUpdateSchema, {
      name: form.value.name,
      role: form.value.role,
      is_active: form.value.is_active,
    })
    errors.value = res.ok ? {} : { ...res.errors }
    if (!res.ok) return
    try {
      await update.mutateAsync({
        id: editId.value,
        payload: { name: res.data.name, role: res.data.role, is_active: res.data.is_active },
      })
      toast.success('Usuario actualizado')
      modalOpen.value = false
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
    return
  }

  const res = validate(userRegisterSchema, {
    email: form.value.email,
    name: form.value.name,
    role: form.value.role,
    password: form.value.password,
  })
  errors.value = res.ok ? {} : { ...res.errors }
  if (!res.ok) return
  try {
    await register.mutateAsync({
      email: res.data.email,
      name: res.data.name,
      role: res.data.role,
      password: res.data.password,
    })
    modalOpen.value = false
    toast.success('Usuario registrado')
    // Mostramos la contraseña temporal entregada (una sola vez).
    showTempPassword(res.data.password)
  } catch (e) {
    toast.error(apiErrorMessage(e))
  }
}

// --- Activar / desactivar -----------------------------------------------------
const toggleOpen = ref(false)
const target = ref<AdminUser | null>(null)

const toggleMessage = computed(() => {
  if (!target.value) return ''
  return target.value.is_active
    ? `¿Desactivar a “${target.value.name}”? No podrá iniciar sesión hasta reactivarlo.`
    : `¿Activar a “${target.value.name}”? Podrá iniciar sesión nuevamente.`
})

function askToggle(user: AdminUser) {
  target.value = user
  toggleOpen.value = true
}
async function confirmToggle() {
  if (!target.value) return
  const next = !target.value.is_active
  try {
    await update.mutateAsync({ id: target.value.id, payload: { is_active: next } })
    toast.success(next ? 'Usuario activado' : 'Usuario desactivado')
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    toggleOpen.value = false
    target.value = null
  }
}

// --- Resetear contraseña ------------------------------------------------------
const resetOpen = ref(false)
function askReset(user: AdminUser) {
  target.value = user
  resetOpen.value = true
}
async function confirmReset() {
  if (!target.value) return
  try {
    const result = await resetPassword.mutateAsync({ userId: target.value.id })
    toast.success('Contraseña reseteada')
    showTempPassword(result.temporary_password)
  } catch (e) {
    toast.error(apiErrorMessage(e))
  } finally {
    resetOpen.value = false
    target.value = null
  }
}

// --- Contraseña temporal (mostrar una sola vez) -------------------------------
const tempOpen = ref(false)
const tempPassword = ref('')
const copied = ref(false)

function showTempPassword(pwd: string) {
  tempPassword.value = pwd
  copied.value = false
  tempOpen.value = true
}
async function copyTemp() {
  try {
    await navigator.clipboard.writeText(tempPassword.value)
    copied.value = true
  } catch {
    toast.error('No se pudo copiar. Selecciónala y cópiala manualmente.')
  }
}
function closeTemp() {
  tempOpen.value = false
  tempPassword.value = ''
  copied.value = false
}

const roleFormOptions = [{ value: '', label: 'Selecciona un rol…' }, ...ROLE_OPTIONS]
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Usuarios"
      crumb="Administración"
      :subtitle="total ? `${total} ${total === 1 ? 'usuario registrado' : 'usuarios registrados'}` : 'Cuentas de acceso al sistema'"
    >
      <template #actions>
        <RoleGate :roles="['ADMIN']">
          <AppButton @click="openCreate"><UserPlus /> Registrar usuario</AppButton>
        </RoleGate>
      </template>
    </PageHeader>

    <!-- Error -->
    <div v-if="isError" class="rounded-lg border border-danger-br bg-danger-bg p-6 text-center">
      <p class="text-sm text-danger">No se pudieron cargar los usuarios.</p>
      <AppButton variant="outline" size="sm" class="mt-3" @click="() => refetch()">
        <RotateCcw /> Reintentar
      </AppButton>
    </div>

    <!-- Carga inicial -->
    <div v-else-if="isLoading" class="space-y-3">
      <SkeletonBlock v-for="n in 6" :key="n" height="52px" rounded="12px" />
    </div>

    <!-- Vacío -->
    <div v-else-if="!rows.length" class="rounded-lg border border-neutral-200 bg-white">
      <EmptyState title="Sin usuarios" message="Aún no se han registrado usuarios.">
        <template #icon><UsersIcon /></template>
        <template #action>
          <RoleGate :roles="['ADMIN']">
            <AppButton size="sm" @click="openCreate"><UserPlus /> Registrar usuario</AppButton>
          </RoleGate>
        </template>
      </EmptyState>
    </div>

    <!-- Tabla -->
    <template v-else>
      <DataTable
        :columns="columns"
        :rows="rows"
        :class="{ 'opacity-60 transition-opacity': isFetching }"
      >
        <template #name="{ row }">
          <span class="font-semibold text-neutral-900">{{ (row as AdminUser).name }}</span>
        </template>

        <template #role="{ row }">
          <span
            class="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"
          >
            {{ roleLabel((row as AdminUser).role) }}
          </span>
        </template>

        <template #is_active="{ row }">
          <span
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
              (row as AdminUser).is_active
                ? 'text-success bg-success-bg border-success-br'
                : 'text-neutral-500 bg-neutral-100 border-neutral-200',
            ]"
          >
            <span class="h-[7px] w-[7px] rounded-full bg-current" />
            {{ (row as AdminUser).is_active ? 'Activo' : 'Inactivo' }}
          </span>
        </template>

        <template #last_login_at="{ row }">
          <span class="text-neutral-600">{{ formatLastLogin((row as AdminUser).last_login_at) }}</span>
        </template>

        <template #actions="{ row }">
          <RoleGate :roles="['ADMIN']">
            <div class="flex justify-end gap-1">
              <AppButton variant="ghost" size="sm" @click="openEdit(row as AdminUser)">
                <Pencil /> Editar
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="askToggle(row as AdminUser)">
                <Power /> {{ (row as AdminUser).is_active ? 'Desactivar' : 'Activar' }}
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="askReset(row as AdminUser)">
                <KeyRound /> Resetear
              </AppButton>
            </div>
          </RoleGate>
        </template>

        <template #footer>
          <span>Página {{ page }} de {{ totalPages }}</span>
          <div class="flex items-center gap-2">
            <AppButton variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
              <ChevronLeft />
            </AppButton>
            <AppButton variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
              <ChevronRight />
            </AppButton>
          </div>
        </template>
      </DataTable>
    </template>

    <!-- Modal crear / editar -->
    <BaseModal
      :open="modalOpen"
      :title="editId != null ? 'Editar usuario' : 'Registrar usuario'"
      max-width="max-w-[520px]"
      @close="modalOpen = false"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <FormField
          v-if="editId == null"
          label="Correo electrónico"
          required
          :error="errors.email"
          input-id="user-email"
        >
          <input
            id="user-email"
            v-model="form.email"
            type="email"
            class="control"
            placeholder="usuario@dominio.com"
          />
        </FormField>

        <FormField label="Nombre" required :error="errors.name" input-id="user-name">
          <input id="user-name" v-model="form.name" class="control" placeholder="Nombre completo" />
        </FormField>

        <SelectField
          v-model="form.role"
          label="Rol"
          required
          :options="roleFormOptions"
          :error="errors.role"
          input-id="user-role"
        />

        <FormField
          v-if="editId == null"
          label="Contraseña temporal"
          required
          :error="errors.password"
          hint="Se generó automáticamente. Entrégala al usuario; deberá cambiarla en su primer ingreso."
          input-id="user-password"
        >
          <div class="flex gap-2">
            <input id="user-password" v-model="form.password" class="control font-mono" />
            <AppButton type="button" variant="outline" size="sm" @click="regeneratePassword">
              <RotateCcw /> Generar
            </AppButton>
          </div>
        </FormField>

        <label
          v-if="editId != null"
          class="flex items-center gap-2 text-sm font-semibold text-neutral-700"
        >
          <input v-model="form.is_active" type="checkbox" class="h-4 w-4" />
          Usuario activo
        </label>
      </form>

      <template #footer>
        <AppButton variant="ghost" @click="modalOpen = false">Cancelar</AppButton>
        <AppButton :disabled="saving" @click="submit">
          {{ saving ? 'Guardando…' : editId != null ? 'Guardar cambios' : 'Registrar' }}
        </AppButton>
      </template>
    </BaseModal>

    <!-- Confirmar activar / desactivar -->
    <ConfirmDialog
      :open="toggleOpen"
      :title="target?.is_active ? 'Desactivar usuario' : 'Activar usuario'"
      :message="toggleMessage"
      :confirm-label="target?.is_active ? 'Desactivar' : 'Activar'"
      :tone="target?.is_active ? 'danger' : 'warning'"
      @confirm="confirmToggle"
      @close="toggleOpen = false"
    />

    <!-- Confirmar reseteo de contraseña -->
    <ConfirmDialog
      :open="resetOpen"
      title="Resetear contraseña"
      :message="target ? `Se generará una nueva contraseña temporal para “${target.name}”. La contraseña actual dejará de funcionar.` : ''"
      confirm-label="Resetear"
      tone="warning"
      @confirm="confirmReset"
      @close="resetOpen = false"
    />

    <!-- Contraseña temporal (mostrar una sola vez) -->
    <BaseModal
      :open="tempOpen"
      title="Contraseña temporal"
      max-width="max-w-[440px]"
      @close="closeTemp"
    >
      <p class="text-sm text-neutral-600">
        Guarda esta contraseña y entrégala al usuario. <strong>No volverá a mostrarse.</strong>
      </p>
      <div class="mt-3 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <code class="flex-1 font-mono text-sm break-all text-neutral-900 select-all">{{ tempPassword }}</code>
        <AppButton variant="outline" size="sm" @click="copyTemp">
          <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copiado' : 'Copiar' }}
        </AppButton>
      </div>
      <p class="mt-3 text-sm text-warning">El usuario deberá cambiarla en su primer inicio de sesión.</p>

      <template #footer>
        <AppButton @click="closeTemp">Entendido</AppButton>
      </template>
    </BaseModal>
  </section>
</template>
