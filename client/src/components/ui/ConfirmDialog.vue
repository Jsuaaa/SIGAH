<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
import BaseModal from './BaseModal.vue'
import AppButton from './AppButton.vue'

withDefaults(
  defineProps<{
    open: boolean
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'danger' | 'warning'
  }>(),
  { confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', tone: 'danger' },
)
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'close'): void }>()
</script>

<template>
  <BaseModal :open="open" max-width="max-w-[420px]" @close="emit('close')">
    <template #title>
      <div class="flex items-start gap-3">
        <span
          :class="[
            'grid h-11 w-11 flex-none place-items-center rounded-full [&>svg]:h-5 [&>svg]:w-5',
            tone === 'warning' ? 'bg-warning-bg text-warning' : 'bg-danger-bg text-danger',
          ]"
        >
          <TriangleAlert />
        </span>
        <div>
          <h3 class="text-xl font-semibold text-neutral-900">{{ title }}</h3>
          <p v-if="message" class="mt-1 text-sm text-neutral-500">{{ message }}</p>
        </div>
      </div>
    </template>
    <template #footer>
      <AppButton variant="ghost" @click="emit('close')">{{ cancelLabel }}</AppButton>
      <AppButton :variant="tone === 'warning' ? 'primary' : 'danger'" @click="emit('confirm')">
        {{ confirmLabel }}
      </AppButton>
    </template>
  </BaseModal>
</template>
