<script setup lang="ts">
// Botón institucional. Altura mínima 44px (md) para uso en campo (touch).
withDefaults(
  defineProps<{
    variant?: 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button', disabled: false },
)

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 border-transparent',
  accent: 'bg-accent-600 text-white hover:bg-accent-700 border-transparent',
  outline: 'bg-white text-primary-700 border-neutral-300 hover:border-primary-400 hover:bg-primary-50',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 border-transparent',
  danger: 'bg-danger text-white hover:bg-[#991b1b] border-transparent',
}
const sizes = {
  md: 'min-h-11 px-5 text-base',
  sm: 'min-h-9 px-3 text-sm',
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:h-[18px] [&>svg]:w-[18px]',
      variants[variant],
      sizes[size],
    ]"
  >
    <slot />
  </button>
</template>
