<script setup lang="ts">
import { computed } from 'vue'
import type { FamilyStatus } from '@/types/family.types'

const props = defineProps<{ status: FamilyStatus }>()

const map = {
  ACTIVO: { label: 'Activa', cls: 'text-success bg-success-bg border-success-br' },
  EN_REFUGIO: { label: 'En refugio', cls: 'text-primary-700 bg-info-bg border-info-br' },
  EVACUADO: { label: 'Evacuada', cls: 'text-warning bg-warning-bg border-warning-br' },
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
