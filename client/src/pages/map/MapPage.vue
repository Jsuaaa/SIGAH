<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'

// Página del mapa con capas (HU-13) y focos sanitarios (HU-26).
// La vista de Leaflet es pesada (mapa + tiles + leaflet); la cargamos de forma
// DIFERIDA con defineAsyncComponent para no penalizar el bundle inicial. Mientras
// resuelve el chunk se muestra un placeholder.
const MapView = defineAsyncComponent({
  loader: () => import('./MapView.vue'),
  loadingComponent: {
    template:
      '<div class="grid min-h-[480px] place-items-center text-neutral-500">Cargando mapa…</div>',
  },
  errorComponent: {
    template:
      '<div class="grid min-h-[480px] place-items-center text-danger">No se pudo cargar el mapa.</div>',
  },
  delay: 120,
})
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Mapa"
      subtitle="Refugios, bodegas, familias, focos sanitarios y entregas por capas"
    />
    <MapView />
  </section>
</template>
