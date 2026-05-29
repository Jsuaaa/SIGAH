<script setup lang="ts">
import { ref, watch } from 'vue'
import { Search } from '@lucide/vue'

// Input de búsqueda con debounce. Emite update:modelValue ya recortado.
const props = withDefaults(
  defineProps<{ modelValue: string; placeholder?: string; delay?: number }>(),
  { placeholder: 'Buscar…', delay: 300 },
)
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const text = ref(props.modelValue)
let timer: ReturnType<typeof setTimeout> | undefined

watch(text, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => emit('update:modelValue', v.trim()), props.delay)
})

// Si el valor externo cambia (p. ej. al limpiar filtros) refleja el input.
watch(
  () => props.modelValue,
  (v) => {
    if (v !== text.value) text.value = v
  },
)
</script>

<template>
  <div class="relative">
    <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
    <input v-model="text" type="search" :placeholder="placeholder" class="control pl-9" />
  </div>
</template>
