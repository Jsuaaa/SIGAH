<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import SigahLogo from '@/components/SigahLogo.vue'
import FormField from '@/components/form/FormField.vue'
import AppButton from '@/components/ui/AppButton.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  loading.value = true
  try {
    const user = await auth.login({ email: email.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(user?.password_must_change ? '/change-password' : redirect)
  } catch {
    // TODO: mostrar cuenta regresiva de lockout usando locked_until (HU-02 CA5).
    toast.error('Credenciales inválidas o cuenta bloqueada')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 flex flex-col items-center gap-3 text-center">
        <SigahLogo :size="56" />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-neutral-900">SIGAH</h1>
          <p class="text-sm text-neutral-500">Gestión y Distribución de Ayudas Humanitarias</p>
        </div>
      </div>

      <form
        class="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
        @submit.prevent="onSubmit"
      >
        <FormField label="Correo" required input-id="email">
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="username"
            class="control"
          />
        </FormField>

        <FormField label="Contraseña" required input-id="password">
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="control"
          />
        </FormField>

        <AppButton type="submit" :disabled="loading" class="w-full">
          {{ loading ? 'Ingresando…' : 'Iniciar sesión' }}
        </AppButton>
      </form>

      <p class="mt-4 text-center text-xs text-neutral-400">Alcaldía de Montería · 2026</p>
    </div>
  </div>
</template>
