<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import AppButton from '@/components/ui/AppButton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'

const route = useRoute()
const router = useRouter()
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Detalle de familia"
      :crumb="`Familias · #${route.params.id}`"
      subtitle="Pantalla pendiente (HU-08: puntaje con desglose + pestañas)"
    >
      <template #actions>
        <AppButton variant="outline" @click="router.push('/families')">
          <ArrowLeft /> Volver
        </AppButton>
      </template>
    </PageHeader>
    <div class="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
      Detalle de la familia #{{ route.params.id }} — en construcción.
    </div>
  </section>
</template>
