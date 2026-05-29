<script setup lang="ts">
// Tarjeta de indicador. Icono en slot #icon; delta opcional con tendencia.
withDefaults(
  defineProps<{
    label: string
    value: string | number
    delta?: string
    trend?: 'up' | 'down'
    tone?: 'primary' | 'accent' | 'warning' | 'danger'
  }>(),
  { tone: 'primary' },
)

const toneCls = {
  primary: 'bg-primary-50 text-primary-600',
  accent: 'bg-accent-50 text-accent-600',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}
</script>

<template>
  <div class="rounded-lg border border-neutral-200 bg-white p-5 shadow-xs">
    <div class="mb-3 flex items-center justify-between">
      <span class="text-sm font-medium text-neutral-500">{{ label }}</span>
      <span
        :class="['grid h-[38px] w-[38px] place-items-center rounded-md [&>svg]:h-5 [&>svg]:w-5', toneCls[tone]]"
      >
        <slot name="icon" />
      </span>
    </div>
    <div class="text-3xl font-bold tracking-tight text-neutral-900">{{ value }}</div>
    <div
      v-if="delta"
      :class="[
        'mt-1 inline-flex items-center gap-1 text-sm font-medium',
        trend === 'down' ? 'text-danger' : 'text-success',
      ]"
    >
      <slot name="delta-icon" />
      {{ delta }}
    </div>
  </div>
</template>
