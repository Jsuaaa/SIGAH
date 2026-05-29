<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { apiErrorMessage, apiErrorStatus } from '@/utils/apiError'
import SigahLogo from '@/components/SigahLogo.vue'
import FormField from '@/components/form/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'

const auth = useAuthStore()
const router = useRouter()

const current = ref('')
const next = ref('')
const confirm = ref('')
const errors = ref<Record<string, string>>({})
const loading = ref(false)

function validate() {
  const e: Record<string, string> = {}
  if (!current.value) e.current = 'Ingresa tu contraseña actual.'
  if (next.value.length < 8) e.next = 'La nueva contraseña debe tener al menos 8 caracteres.'
  if (confirm.value !== next.value) e.confirm = 'Las contraseñas no coinciden.'
  if (current.value && next.value && current.value === next.value) {
    e.next = 'La nueva contraseña debe ser distinta de la actual.'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

async function onSubmit() {
  if (!validate()) return
  loading.value = true
  try {
    await auth.changePassword(current.value, next.value)
    toast.success('Contraseña actualizada')
    router.push('/dashboard')
  } catch (err) {
    if (apiErrorStatus(err) === 401) {
      errors.value = { current: 'La contraseña actual es incorrecta.' }
    } else {
      toast.error(apiErrorMessage(err, 'No se pudo cambiar la contraseña.'))
    }
  } finally {
    loading.value = false
  }
}

function onLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <SigahLogo :size="56" />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-neutral-900">Cambiar contraseña</h1>
          <p class="text-sm text-neutral-500">Define una contraseña personal y segura</p>
        </div>
      </div>

      <p
        v-if="auth.mustChangePassword"
        class="mb-4 rounded-md border border-warning-br bg-warning-bg p-3 text-sm text-warning"
      >
        Tu contraseña es temporal. Debes cambiarla antes de continuar.
      </p>

      <form
        class="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
        @submit.prevent="onSubmit"
      >
        <FormField label="Contraseña actual" required :error="errors.current" input-id="cp-current">
          <input
            id="cp-current"
            v-model="current"
            type="password"
            autocomplete="current-password"
            class="control"
          />
        </FormField>

        <FormField
          label="Nueva contraseña"
          required
          :error="errors.next"
          input-id="cp-next"
          hint="Mínimo 8 caracteres."
        >
          <input id="cp-next" v-model="next" type="password" autocomplete="new-password" class="control" />
        </FormField>

        <FormField label="Confirmar nueva contraseña" required :error="errors.confirm" input-id="cp-confirm">
          <input
            id="cp-confirm"
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            class="control"
          />
        </FormField>

        <AppButton type="submit" :disabled="loading" class="w-full">
          {{ loading ? 'Guardando…' : 'Cambiar contraseña' }}
        </AppButton>
      </form>

      <button
        type="button"
        class="mt-4 w-full text-center text-sm text-neutral-500 hover:text-neutral-700"
        @click="onLogout"
      >
        Cerrar sesión
      </button>
    </div>
  </div>
</template>
