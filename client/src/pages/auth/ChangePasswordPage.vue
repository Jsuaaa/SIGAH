<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/stores/auth'
import { validate } from '@/utils/validation'
import { changePasswordSchema } from '@/schemas/auth.schema'
import { apiErrorMessage } from '@/utils/apiError'
import SigahLogo from '@/components/SigahLogo.vue'
import FormField from '@/components/form/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

// HU-03: obligatorio cuando password_must_change=true (el guard del router ya
// fuerza esta ruta); en ese caso no permitimos cancelar.
const mandatory = computed(() => auth.mustChangePassword)

const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const errors = ref<Record<string, string>>({})
const loading = ref(false)

async function onSubmit() {
  errors.value = {}
  const res = validate(changePasswordSchema, { ...form })
  if (!res.ok) {
    errors.value = res.errors
    return
  }
  loading.value = true
  try {
    await authApi.changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword })
    await auth.fetchMe() // refresca el perfil: password_must_change pasa a false
    toast.success('Contraseña actualizada')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (e) {
    toast.error(apiErrorMessage(e))
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
          <p class="text-sm text-neutral-500">
            {{
              mandatory
                ? 'Debes cambiar tu contraseña temporal antes de continuar.'
                : 'Actualiza tu contraseña de acceso.'
            }}
          </p>
        </div>
      </div>

      <form
        class="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
        @submit.prevent="onSubmit"
      >
        <FormField label="Contraseña actual" required input-id="oldPassword" :error="errors.oldPassword">
          <input
            id="oldPassword"
            v-model="form.oldPassword"
            type="password"
            autocomplete="current-password"
            class="control"
          />
        </FormField>

        <FormField
          label="Nueva contraseña"
          required
          input-id="newPassword"
          :error="errors.newPassword"
          hint="Mínimo 8 caracteres."
        >
          <input
            id="newPassword"
            v-model="form.newPassword"
            type="password"
            autocomplete="new-password"
            class="control"
          />
        </FormField>

        <FormField
          label="Confirmar nueva contraseña"
          required
          input-id="confirmPassword"
          :error="errors.confirmPassword"
        >
          <input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            class="control"
          />
        </FormField>

        <AppButton type="submit" :disabled="loading" class="w-full">
          {{ loading ? 'Guardando…' : 'Cambiar contraseña' }}
        </AppButton>

        <div class="flex justify-between text-xs">
          <RouterLink
            v-if="!mandatory"
            to="/dashboard"
            class="text-neutral-500 hover:text-neutral-700"
          >
            Cancelar
          </RouterLink>
          <span v-else></span>
          <button type="button" class="text-neutral-500 hover:text-neutral-700" @click="onLogout">
            Cerrar sesión
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
