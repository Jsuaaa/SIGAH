<script setup lang="ts">
import { FileText, Sheet } from '@lucide/vue'
import AppButton from './AppButton.vue'

// Botones de exportación de reportes (HU-28/29). Emite el formato solicitado;
// el backend acepta ?format=pdf|xlsx.
defineEmits<{ (e: 'export', format: 'pdf' | 'xlsx'): void }>()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <AppButton variant="outline" size="sm" @click="$emit('export', 'pdf')">
      <FileText /> Exportar PDF
    </AppButton>
    <AppButton variant="outline" size="sm" @click="$emit('export', 'xlsx')">
      <Sheet /> Exportar Excel
    </AppButton>
  </div>
</template>
