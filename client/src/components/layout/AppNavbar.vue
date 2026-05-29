<script setup lang="ts">
import { computed } from 'vue'
import { Menu, LogOut, Search } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ConnectionBadge from './ConnectionBadge.vue'
import SigahLogo from '@/components/SigahLogo.vue'

defineEmits<{ (e: 'toggle-sidebar'): void }>()

const auth = useAuthStore()
const router = useRouter()

const initials = computed(() => {
  const n = auth.user?.name?.trim() ?? ''
  if (!n) return '—'
  const parts = n.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
})

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header
    class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4"
  >
    <button
      type="button"
      class="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden"
      aria-label="Abrir menú"
      @click="$emit('toggle-sidebar')"
    >
      <Menu class="h-5 w-5" />
    </button>

    <SigahLogo :size="28" class="lg:hidden" />

    <!-- Búsqueda global (se conecta en HU-06) -->
    <div
      class="ml-2 hidden max-w-[320px] flex-1 items-center gap-2 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-500 md:flex"
    >
      <Search class="h-4 w-4" />
      Buscar familia por código o documento…
    </div>

    <div class="ml-auto flex items-center gap-3">
      <ConnectionBadge />
      <p class="hidden text-sm font-medium text-neutral-700 sm:block">{{ auth.user?.name }}</p>
      <span class="grid h-9 w-9 place-items-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
        {{ initials }}
      </span>
      <button
        type="button"
        class="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
        aria-label="Salir"
        @click="logout"
      >
        <LogOut class="h-4 w-4" />
      </button>
    </div>
  </header>
</template>
