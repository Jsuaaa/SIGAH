<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import AppButton from '@/components/ui/AppButton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'

const router = useRouter()
</script>

<template>
  <section class="space-y-5">
    <PageHeader
      title="Registrar familia"
      crumb="Censo"
      subtitle="Pantalla pendiente (HU-04: censo offline + consentimiento Ley 1581)"
    >
      <template #actions>
        <AppButton variant="outline" @click="router.push('/families')">
          <ArrowLeft /> Volver
        </AppButton>
      </template>
    </PageHeader>
    <div class="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
      Formulario de censo — en construcción (HU-04).
    </div>
  </section>
</template>
