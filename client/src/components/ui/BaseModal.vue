<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionRoot, TransitionChild } from '@headlessui/vue'
import { X } from '@lucide/vue'

defineProps<{ open: boolean; title?: string; maxWidth?: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="relative z-50" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="duration-200 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-150 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-neutral-900/50" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 grid place-items-center p-4">
        <TransitionChild
          as="template"
          enter="duration-200 ease-out"
          enter-from="opacity-0 translate-y-2 scale-95"
          enter-to="opacity-100 translate-y-0 scale-100"
          leave="duration-150 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel
            :class="['w-full overflow-hidden rounded-xl bg-white shadow-lg', maxWidth || 'max-w-[480px]']"
          >
            <div
              v-if="title || $slots.title"
              class="flex items-start justify-between gap-4 px-6 pt-6 pb-2"
            >
              <DialogTitle class="text-xl font-semibold text-neutral-900">
                <slot name="title">{{ title }}</slot>
              </DialogTitle>
              <button
                type="button"
                class="rounded-sm p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Cerrar"
                @click="emit('close')"
              >
                <X class="h-5 w-5" />
              </button>
            </div>
            <div v-if="$slots.default" class="px-6 pt-2 pb-6 text-neutral-600"><slot /></div>
            <div
              v-if="$slots.footer"
              class="flex justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4"
            >
              <slot name="footer" />
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
