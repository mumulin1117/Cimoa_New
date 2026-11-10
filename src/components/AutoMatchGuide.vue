<script setup>
import { ref } from 'vue'
import { AUTO_MATCH_GUIDE_TARGETS } from '@/utils/autoMatchGuideLayout.js'
import SpotlightGuide from './SpotlightGuide.vue'

defineProps({ open: { type: Boolean, default: false }, step: { type: Number, default: 0 }, busy: { type: Boolean, default: false }, error: { type: String, default: '' } })
const emit = defineEmits(['next', 'back', 'skip', 'relayout'])
const spotlight = ref(null)
const steps = Object.freeze([
  { title: 'Meet your campus, one person at a time', description: 'Auto Match helps you meet another student who’s available to connect.', action: 'Show me how', icon: 'lightning' },
  { title: 'Make it your kind of match', description: 'Set the preferences that matter to you. You can change them before joining the pool.', action: 'Next', icon: 'filter' },
  { title: 'You choose when to begin', description: 'Joining starts a search using the free match or coin amount shown on this page. Nothing starts during this guide.', action: 'Next', icon: 'lightning' },
  { title: 'A match is only the beginning', description: 'You both choose whether to connect before chat opens. During a search, you can pause or leave the pool.', action: 'Got it', icon: 'people' },
])
defineExpose({ remeasure: () => spotlight.value?.remeasure() })
</script>

<template>
  <SpotlightGuide ref="spotlight" :open="open" :step="step" :busy="busy" :error="error" :steps="steps" :targets="AUTO_MATCH_GUIDE_TARGETS" @next="emit('next')" @back="emit('back')" @skip="emit('skip')" @relayout="emit('relayout', $event)" />
</template>
