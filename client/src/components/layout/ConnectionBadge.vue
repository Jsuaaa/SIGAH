<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { RefreshCw } from '@lucide/vue'
import { useSyncStore } from '@/stores/sync'
import { allOps, type PendingOp } from '@/lib/offlineQueue'
import { flushQueue } from '@/lib/syncManager'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppButton from '@/components/ui/AppButton.vue'

const sync = useSyncStore()
const { status, pendingCount, lastSyncAt } = storeToRefs(sync)

const cfg = computed(
  () =>
    ({
      online: { label: 'En línea', cls: 'text-success bg-success-bg border-success-br', dot: 'bg-success' },
      syncing: { label: 'Sincronizando…', cls: 'text-primary-700 bg-info-bg border-info-br', dot: 'bg-primary-600' },
      offline: { label: 'Sin conexión', cls: 'text-danger bg-danger-bg border-danger-br', dot: 'bg-danger' },
    })[status.value],
)

const open = ref(false)
const ops = ref<PendingOp[]>([])
const syncing = computed(() => status.value === 'syncing')

async function openPanel() {
  ops.value = await allOps()
  open.value = true
}
async function syncNow() {
  if (!navigator.onLine) {
    toast.error('Sin conexión: no se puede sincronizar todavía.')
    return
  }
  const res = await flushQueue()
  ops.value = await allOps()
  if (res) {
    toast.success(`Sincronización: ${res.sent} enviada(s)${res.failed ? `, ${res.failed} con error` : ''}`)
  }
}
function fmt(s: string | null) {
  return s ? new Date(s).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'
}
</script>

<template>
  <button
    type="button"
    :class="['inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium', cfg.cls]"
    @click="openPanel"
  >
    <span class="relative flex h-2 w-2">
      <span v-if="status === 'online'" :class="['absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', cfg.dot]" />
      <span :class="['relative inline-flex h-2 w-2 rounded-full', cfg.dot]" />
    </span>
    {{ cfg.label }}
    <span v-if="pendingCount > 0" class="rounded-full bg-neutral-900/10 px-1.5 text-xs font-bold">{{ pendingCount }}</span>
  </button>

  <BaseModal :open="open" title="Sincronización offline" max-width="max-w-[520px]" @close="open = false">
    <div class="space-y-4">
      <div class="flex items-center justify-between text-sm">
        <span class="text-neutral-600">Estado: <strong :class="cfg.cls.split(' ')[0]">{{ cfg.label }}</strong></span>
        <span class="text-neutral-500">Última sinc.: {{ fmt(lastSyncAt) }}</span>
      </div>

      <div v-if="ops.length" class="space-y-2">
        <p class="text-sm text-neutral-600">{{ ops.length }} operación(es) pendiente(s) de sincronizar:</p>
        <ul class="max-h-64 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
          <li v-for="op in ops" :key="op.client_op_id" class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span class="min-w-0">
              <span class="font-medium text-neutral-900">{{ op.label }}</span>
              <span class="block text-xs text-neutral-400">{{ fmt(op.created_at) }}<span v-if="op.last_error"> · {{ op.last_error }}</span></span>
            </span>
            <span v-if="op.attempts > 0" class="rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">{{ op.attempts }} intento(s)</span>
          </li>
        </ul>
      </div>
      <p v-else class="rounded-md bg-success-bg p-3 text-sm text-success">Todo sincronizado. No hay operaciones pendientes.</p>
    </div>
    <template #footer>
      <AppButton variant="ghost" @click="open = false">Cerrar</AppButton>
      <AppButton :disabled="syncing || !ops.length || !cfg" @click="syncNow"><RefreshCw /> Sincronizar ahora</AppButton>
    </template>
  </BaseModal>
</template>
