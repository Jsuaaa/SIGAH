<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/types/auth.types'

// Renderiza su contenido solo si el usuario tiene alguno de los roles dados.
// Uso: <RoleGate :roles="['ADMIN','COORDINADOR_LOGISTICA']"> ... </RoleGate>
const props = defineProps<{ roles: Role[] }>()
const auth = useAuthStore()
</script>

<template>
  <slot v-if="auth.hasRole(...props.roles)" />
</template>
