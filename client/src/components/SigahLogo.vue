<script setup lang="ts">
// Isotipo SIGAH: nodo de distribución que irradia a la red de refugios/bodegas.
// `light` = variante para fondos oscuros (sidebar). `wordmark` muestra el texto.
withDefaults(
  defineProps<{ size?: number; light?: boolean; wordmark?: boolean }>(),
  { size: 32, light: false, wordmark: false },
)
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <svg :width="size" :height="size" viewBox="0 0 48 48" role="img" aria-label="SIGAH">
      <rect x="1" y="1" width="46" height="46" rx="12" :fill="light ? '#ffffff' : '#1e5ba8'" :fill-opacity="light ? 0.12 : 1" />
      <g stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" opacity="0.9">
        <line x1="24" y1="24" x2="14" y2="14" />
        <line x1="24" y1="24" x2="34" y2="15" />
        <line x1="24" y1="24" x2="15" y2="34" />
        <line x1="24" y1="24" x2="34" y2="34" />
      </g>
      <circle cx="24" cy="24" r="5.4" fill="#ffffff" />
      <circle cx="24" cy="24" r="2.4" :fill="light ? '#1e5ba8' : '#0e7c66'" />
      <circle cx="14" cy="14" r="3.1" fill="#ffffff" />
      <circle cx="34" cy="15" r="3.1" fill="#a3e3d0" />
      <circle cx="15" cy="34" r="3.1" fill="#a3e3d0" />
      <circle cx="34" cy="34" r="3.1" fill="#ffffff" />
    </svg>
    <span v-if="wordmark" class="flex flex-col leading-none">
      <span class="text-lg font-bold tracking-wide" :class="light ? 'text-white' : 'text-neutral-900'">SIGAH</span>
      <span class="text-[11px]" :class="light ? 'text-primary-200' : 'text-neutral-500'">Ayudas Humanitarias</span>
    </span>
  </span>
</template>
