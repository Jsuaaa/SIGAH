<script setup lang="ts">
import { Check } from '@lucide/vue'

// Indicador de pasos (entrega multi-step, wizard de plan).
defineProps<{ steps: string[]; current: number }>()
</script>

<template>
  <ol class="flex items-start">
    <li
      v-for="(step, i) in steps"
      :key="step"
      class="relative flex flex-1 flex-col items-center gap-2 text-center"
    >
      <span
        v-if="i > 0"
        :class="[
          'absolute top-[19px] left-[-50%] -z-0 h-0.5 w-full',
          i <= current ? 'bg-accent-600' : 'bg-neutral-300',
        ]"
      />
      <span
        :class="[
          'z-[1] grid h-[38px] w-[38px] place-items-center rounded-full border-2 text-sm font-bold',
          i < current
            ? 'border-accent-600 bg-accent-600 text-white'
            : i === current
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-neutral-300 bg-white text-neutral-500',
        ]"
      >
        <Check v-if="i < current" class="h-[18px] w-[18px]" />
        <template v-else>{{ i + 1 }}</template>
      </span>
      <span
        :class="[
          'text-sm',
          i === current
            ? 'font-semibold text-primary-700'
            : i < current
              ? 'font-medium text-neutral-700'
              : 'font-medium text-neutral-500',
        ]"
      >
        {{ step }}
      </span>
    </li>
  </ol>
</template>
