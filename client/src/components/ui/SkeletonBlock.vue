<script setup lang="ts">
withDefaults(defineProps<{ width?: string; height?: string; rounded?: string }>(), {
  width: '100%',
  height: '12px',
  rounded: '6px',
})
</script>

<template>
  <span class="sg-skel block" :style="{ width, height, borderRadius: rounded }" aria-hidden="true" />
</template>

<style scoped>
.sg-skel {
  background: linear-gradient(
    90deg,
    var(--color-neutral-200) 25%,
    var(--color-neutral-100) 37%,
    var(--color-neutral-200) 63%
  );
  background-size: 400% 100%;
  animation: sg-shimmer 1.4s ease infinite;
}
@keyframes sg-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
