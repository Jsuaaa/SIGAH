<script setup lang="ts">
import { computed } from 'vue'

// Barra con color por umbral. Por defecto orientada a "cobertura" (más = mejor):
// >= ok verde, >= warn ámbar, debajo rojo. Para capacidad de bodega usar `invert`.
const props = withDefaults(
  defineProps<{ value: number; label?: string; ok?: number; warn?: number; invert?: boolean }>(),
  { ok: 70, warn: 40, invert: false },
)

const pct = computed(() => Math.max(0, Math.min(100, Math.round(props.value))))

const tone = computed(() => {
  const v = props.invert ? 100 - pct.value : pct.value
  return v >= props.ok ? 'success' : v >= props.warn ? 'warning' : 'danger'
})

const textCls = computed(() => ({ success: 'text-success', warning: 'text-warning', danger: 'text-danger' })[tone.value])
const fillCls = computed(() => ({ success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' })[tone.value])
</script>

<template>
  <div>
    <div v-if="label" class="mb-1.5 flex justify-between text-sm">
      <span class="text-neutral-700">{{ label }}</span>
      <span :class="['font-semibold', textCls]">{{ pct }}%</span>
    </div>
    <div class="h-2.5 overflow-hidden rounded-full bg-neutral-200">
      <div
        :class="['h-full rounded-full transition-[width] duration-500', fillCls]"
        :style="{ width: pct + '%' }"
      />
    </div>
  </div>
</template>
