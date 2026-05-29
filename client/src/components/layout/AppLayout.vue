<script setup lang="ts">
import { ref } from 'vue'
import AppNavbar from './AppNavbar.vue'
import AppSidebar from './AppSidebar.vue'
import { useConnection } from '@/composables/useConnection'

// Conecta los eventos online/offline del navegador con el sync store.
useConnection()

const sidebarOpen = ref(false)
</script>

<template>
  <div class="min-h-screen bg-neutral-50 text-neutral-900">
    <div class="flex">
      <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
      <div class="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppNavbar @toggle-sidebar="sidebarOpen = !sidebarOpen" />
        <main class="flex-1 p-4 lg:p-6">
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
