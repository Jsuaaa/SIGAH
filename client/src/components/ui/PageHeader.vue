<script setup lang="ts">
defineProps<{ title: string; crumb?: string; subtitle?: string }>()
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p v-if="crumb" class="mb-1 text-sm text-neutral-500">{{ crumb }}</p>
      <h3 class="text-2xl font-semibold text-neutral-900">{{ title }}</h3>
      <p v-if="subtitle" class="mt-1 text-sm text-neutral-500">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
