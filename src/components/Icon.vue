<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 }
})

/* Vite: все svg из src/assets/icons импортируем как raw-строки */
const modules = import.meta.glob('../assets/icons/*.svg', { as: 'raw', eager: true })

const svg = computed(() => {
  const key = `../assets/icons/${props.name}.svg`
  return modules[key] || ''
})
</script>

<template>
  <span
    class="icon"
    :style="{ width: size + 'px', height: size + 'px' }"
    v-html="svg"
  />
</template>

<style scoped>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>