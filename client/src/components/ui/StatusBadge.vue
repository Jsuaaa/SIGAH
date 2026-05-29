<script setup lang="ts">
import { computed } from 'vue'

// Estado de entrega. Acepta los enums del backend (SCHEDULED/IN_PROGRESS/DELIVERED)
// y sus etiquetas en español.
type Status = 'SCHEDULED' | 'IN_PROGRESS' | 'DELIVERED' | 'PROGRAMADA' | 'EN_CURSO' | 'ENTREGADA'
const props = defineProps<{ status: Status }>()

const map = {
  SCHEDULED: { label: 'Programada', cls: 'text-state-programada bg-neutral-100 border-neutral-200' },
  PROGRAMADA: { label: 'Programada', cls: 'text-state-programada bg-neutral-100 border-neutral-200' },
  IN_PROGRESS: { label: 'En curso', cls: 'text-primary-700 bg-info-bg border-info-br' },
  EN_CURSO: { label: 'En curso', cls: 'text-primary-700 bg-info-bg border-info-br' },
  DELIVERED: { label: 'Entregada', cls: 'text-success bg-success-bg border-success-br' },
  ENTREGADA: { label: 'Entregada', cls: 'text-success bg-success-bg border-success-br' },
} as const

const v = computed(() => map[props.status])
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
      v.cls,
    ]"
  >
    <span class="h-[7px] w-[7px] rounded-full bg-current" />
    {{ v.label }}
  </span>
</template>
