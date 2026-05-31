<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import axios from 'axios'
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

// HU-02 CA5: tras 5 intentos fallidos el backend (sp_auth_login) bloquea la
// cuenta 15 min y responde 423 con "Account locked until <timestamp>". Aquí
// mostramos la cuenta regresiva y deshabilitamos el submit hasta que expire.
const lockedUntil = ref<Date | null>(null)
const nowMs = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

const lockRemainingMs = computed(() =>
  lockedUntil.value ? Math.max(0, lockedUntil.value.getTime() - nowMs.value) : 0,
)
const isLocked = computed(() => lockRemainingMs.value > 0)
const lockCountdown = computed(() => {
  const total = Math.ceil(lockRemainingMs.value / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function stopTicker() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function startLock(until: Date) {
  lockedUntil.value = until
  nowMs.value = Date.now()
  stopTicker()
  ticker = setInterval(() => {
    nowMs.value = Date.now()
    if (lockRemainingMs.value <= 0) {
      stopTicker()
      lockedUntil.value = null
    }
  }, 1000)
}

// Parsea "Account locked until 2026-05-31 18:34:00.123+00" → Date, con
// fallback a 15 min si el formato del timestamp de PostgreSQL no es parseable.
function parseLockedUntil(message: string): Date | null {
  const m = message.match(/until\s+(.+?)\s*$/i)
  if (!m) return null
  const raw = m[1].trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

async function onSubmit() {
  if (isLocked.value) return
  loading.value = true
  try {
    const user = await auth.login({ email: email.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(user.password_must_change ? '/change-password' : redirect)
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined
    const message = axios.isAxiosError(e)
      ? ((e.response?.data as { message?: string })?.message ?? '')
      : ''
    if (status === 423) {
      const until = parseLockedUntil(message) ?? new Date(Date.now() + 15 * 60 * 1000)
      startLock(until)
      toast.error('Cuenta bloqueada por intentos fallidos. Espera a que termine la cuenta regresiva.')
    } else {
      toast.error('Credenciales inválidas o cuenta bloqueada')
    }
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(stopTicker)
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
            :disabled="isLocked"
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
            :disabled="isLocked"
            class="control"
          />
        </FormField>

        <!-- HU-02 CA5: aviso de bloqueo con cuenta regresiva -->
        <p
          v-if="isLocked"
          class="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700"
          role="alert"
        >
          Cuenta bloqueada por intentos fallidos. Reintenta en
          <span class="font-semibold tabular-nums">{{ lockCountdown }}</span>
        </p>

        <AppButton type="submit" :disabled="loading || isLocked" class="w-full">
          {{ loading ? 'Ingresando…' : isLocked ? `Bloqueado (${lockCountdown})` : 'Iniciar sesión' }}
        </AppButton>
      </form>

      <p class="mt-4 text-center text-xs text-neutral-400">Alcaldía de Montería · 2026</p>
    </div>
  </div>
</template>
