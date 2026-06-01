<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
const { status, pendingCount } = storeToRefs(sync)

const cfg = computed(
  () =>
    ({
      online: { label: 'En línea', cls: 'text-success bg-success-bg border-success-br', dot: 'bg-success' },
      syncing: { label: 'Sincronizando…', cls: 'text-primary-700 bg-info-bg border-info-br', dot: 'bg-primary-600' },
      offline: { label: 'Sin conexión', cls: 'text-danger bg-danger-bg border-danger-br', dot: 'bg-danger' },
    })[status.value],
)
</script>

<template>
  <span
    :class="['inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium', cfg.cls]"
  >
    <span class="relative flex h-2 w-2">
      <span
        v-if="status === 'online'"
        :class="['absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', cfg.dot]"
      />
      <span :class="['relative inline-flex h-2 w-2 rounded-full', cfg.dot]" />
    </span>
    {{ cfg.label }}
    <span v-if="pendingCount > 0" class="rounded-full bg-neutral-900/10 px-1.5 text-xs font-bold">
      {{ pendingCount }}
    </span>
  </span>
</template>
