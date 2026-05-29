<script setup lang="ts">
import { computed } from 'vue'

// Desglose del puntaje de prioridad por factor (HU-08 CA2).
interface Factor {
  name: string
  points: number
  max: number
}
const props = withDefaults(defineProps<{ factors: Factor[]; total?: number; outOf?: number }>(), {
  outOf: 100,
})

const computedTotal = computed(() => props.total ?? props.factors.reduce((a, f) => a + f.points, 0))
function pct(f: Factor) {
  return f.max ? Math.round((f.points / f.max) * 100) : 0
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-for="f in factors" :key="f.name">
      <div class="mb-1.5 flex justify-between text-sm">
        <span class="font-medium text-neutral-700">{{ f.name }}</span>
        <span class="font-mono font-semibold text-neutral-900">{{ f.points }} / {{ f.max }}</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-neutral-200">
        <div class="h-full rounded-full bg-primary-600" :style="{ width: pct(f) + '%' }" />
      </div>
    </div>
    <div class="flex items-baseline justify-between border-t border-neutral-200 pt-4">
      <span class="text-neutral-500">Puntaje de prioridad</span>
      <span class="text-2xl font-bold text-primary-700">
        {{ computedTotal }} <span class="text-base font-medium text-neutral-400">/ {{ outOf }}</span>
      </span>
    </div>
  </div>
</template>
