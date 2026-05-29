<script setup lang="ts">
import { CircleAlert } from '@lucide/vue'

// Envoltorio de campo: etiqueta + control (slot) + ayuda/error. El control va en
// el slot con clase "control" (ver index.css). Mantiene la etiqueta siempre visible.
defineProps<{ label?: string; required?: boolean; hint?: string; error?: string; inputId?: string }>()
</script>

<template>
  <div>
    <label v-if="label" :for="inputId" class="mb-1.5 block text-sm font-semibold text-neutral-700">
      {{ label }} <span v-if="required" class="text-danger">*</span>
    </label>
    <slot />
    <p v-if="error" class="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
      <CircleAlert class="h-[15px] w-[15px]" /> {{ error }}
    </p>
    <p v-else-if="hint" class="mt-1.5 text-sm text-neutral-500">{{ hint }}</p>
  </div>
</template>
