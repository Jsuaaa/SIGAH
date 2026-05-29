<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>

<template>
  <RouterView />
  <Toaster position="top-right" rich-colors />
</template>
