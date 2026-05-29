<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import FormField from './FormField.vue'

defineProps<{
  label?: string
  required?: boolean
  hint?: string
  error?: string
  inputId?: string
  disabled?: boolean
  options: { value: string | number; label: string }[]
  modelValue?: string | number
}>()
defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <FormField :label="label" :required="required" :hint="hint" :error="error" :input-id="inputId">
    <div class="relative">
      <select
        :id="inputId"
        class="control"
        :class="{ 'cursor-not-allowed opacity-60': disabled }"
        :disabled="disabled"
        :value="modelValue"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <ChevronDown
        class="pointer-events-none absolute top-1/2 right-3.5 h-[18px] w-[18px] -translate-y-1/2 text-neutral-500"
      />
    </div>
  </FormField>
</template>
