<script setup lang="ts">
// Campo de entrada de texto/número/fecha alineado al sistema de diseño. Reutiliza
// FormField para etiqueta/ayuda/error y la clase global `control` (ver index.css),
// igual que SelectField. Emite update:modelValue con el valor crudo del input.
import FormField from './FormField.vue'

withDefaults(
  defineProps<{
    label?: string
    required?: boolean
    hint?: string
    error?: string
    inputId?: string
    disabled?: boolean
    placeholder?: string
    type?: string
    modelValue?: string | number
  }>(),
  { type: 'text' },
)
defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <FormField :label="label" :required="required" :hint="hint" :error="error" :input-id="inputId">
    <input
      :id="inputId"
      class="control"
      :class="{ 'cursor-not-allowed opacity-60': disabled }"
      :type="type"
      :disabled="disabled"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </FormField>
</template>
