<script setup lang="ts">
import { computed } from 'vue'

type Level = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
const props = defineProps<{ level: Level }>()

const map = {
  LOW: { label: 'Bajo', cls: 'text-risk-low bg-risk-low-bg border-success-br' },
  MEDIUM: { label: 'Medio', cls: 'text-risk-medium bg-risk-medium-bg border-warning-br' },
  HIGH: { label: 'Alto', cls: 'text-risk-high bg-risk-high-bg border-[#fed7aa]' },
  CRITICAL: { label: 'Crítico', cls: 'text-risk-critical bg-risk-critical-bg border-danger-br' },
} as const

const v = computed(() => map[props.level])
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
