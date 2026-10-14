<script setup lang="ts">
import { ref } from "vue";
import Crosswave from "@dirwell/theme-crosswave/source";
import type { ThemePage } from "@dirwell/theme-crosswave/model";
defineProps<{ model: ThemePage }>();
const inspected = ref("");
</script>
<template>
  <Crosswave :model="model">
    <template #header="{ model: page }"
      ><span data-custom-header>{{ page.title }} · My media</span></template
    >
    <template #row="{ entry }"
      ><span data-custom-row>{{ entry.name }}</span></template
    >
    <template #actions="{ entry }"
      ><button data-custom-action @click="inspected = entry.id">Inspect path</button></template
    >
    <template #footer="{ model: page }"
      ><span data-custom-footer
        >{{ page.total }} entries · Arrow keys navigate
        <output data-inspected>{{ inspected }}</output></span
      ></template
    >
  </Crosswave>
</template>
<style scoped>
[data-custom-header] {
  color: #f0d6ff;
}
[data-custom-row] {
  font-weight: 600;
}
</style>
