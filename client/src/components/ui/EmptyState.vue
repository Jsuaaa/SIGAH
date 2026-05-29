<script setup lang="ts">
defineProps<{ title: string; message?: string }>()
</script>

<template>
  <div class="px-6 py-12 text-center">
    <div
      class="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-neutral-100 text-neutral-400 [&>svg]:h-7 [&>svg]:w-7"
    >
      <slot name="icon" />
    </div>
    <h4 class="mb-2 text-lg font-semibold text-neutral-900">{{ title }}</h4>
    <p v-if="message" class="mx-auto mb-5 max-w-[38ch] text-sm text-neutral-500">{{ message }}</p>
    <slot name="action" />
  </div>
</template>
