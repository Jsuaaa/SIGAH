<script setup lang="ts">
// Consentimiento Ley 1581/2012 (RN-09). Obligatorio: resalta en ámbar mientras
// no esté marcado; el formulario debe bloquear el envío hasta que sea true.
defineProps<{ modelValue: boolean }>()
defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<template>
  <div
    :class="[
      'flex gap-3 rounded-md border p-4',
      modelValue ? 'border-neutral-300 bg-neutral-50' : 'border-warning-br bg-warning-bg',
    ]"
  >
    <input
      id="privacy-consent"
      type="checkbox"
      :checked="modelValue"
      class="mt-0.5 h-[22px] w-[22px] flex-none cursor-pointer accent-primary-600"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <label for="privacy-consent" class="text-sm leading-snug text-neutral-700">
      Autorizo el tratamiento de mis datos personales conforme a la
      <strong>Ley 1581 de 2012</strong>, para la gestión y entrega de ayudas humanitarias por parte
      de la Alcaldía de Montería. <strong>(Obligatorio)</strong>
    </label>
  </div>
</template>
