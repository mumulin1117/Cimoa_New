<script setup>
import { computed, ref } from 'vue'
import SpotlightGuide from './SpotlightGuide.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  step: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  nextDisabled: { type: Boolean, default: false },
  mode: { type: String, default: 'text' },
  targetUserId: { type: String, default: '' },
  blockedReason: { type: String, default: '' },
})
const emit = defineEmits(['next', 'back', 'skip', 'relayout'])
const spotlight = ref(null)
const voice = computed(() => props.mode === 'voice')
const steps = computed(() => [
  { title: 'There’s a person behind every card', description: 'Tap a card to see their photos, interests and the little things that make them, them.', action: 'View profile', icon: 'person' },
  { title: 'Find a little common ground', description: 'Explore their photos, interests and connection goals. Head back to Discover when you’re ready to say hi.', action: 'Back to Discover', icon: 'people' },
  { title: 'Start with more than “Hi”', description: 'Send shot opens their icebreaker questions. Choose one to start a conversation that feels like you.', action: 'Try Say Hi', icon: 'support' },
  { title: 'Pick something you’d love to answer', description: 'Tap one of their questions below. Your choice gives your introduction a natural place to begin.', action: 'Next', icon: 'support' },
  { title: 'Your voice. Your words.', description: 'Choose Text or Voice below. You can change your mind before sending anything.', action: 'Open your answer', icon: voice.value ? 'mic' : 'support' },
  { title: voice.value ? 'Let your personality come through' : 'A small answer can start something', description: voice.value ? 'When you’re ready, record your answer here. You’ll be able to listen, delete or record again before continuing.' : 'Write your answer here when you’re ready. Keep it personal, thoughtful and true to you.', action: 'Next', icon: voice.value ? 'mic' : 'support' },
  { title: 'You’re in control of the next step', description: voice.value ? 'Review your voice introduction, then confirm the 10-coin cost before sending. After you send, look for Waiting for reply. Chat opens only when you connect.' : 'Sending a text introduction costs 10 coins. You’ll review the cost before confirming. After you send, look for Waiting for reply. Chat opens only when you connect.', action: 'Got it', icon: 'people' },
])
const targets = computed(() => [
  '.discover-photo-card--front .discover-info',
  '.expanded-tags',
  '[data-interaction="photo.sayHi.click.1"]',
  '.ice-questions',
  '.ice-modes',
  voice.value ? '.ice-record-card' : '.ice-reply-card',
  voice.value ? '[data-interaction="ibVoice.sendVoiceRequest.click.1"]' : '[data-interaction="ibText.continueText.click.1"]',
])
const scope = computed(() => props.step === 1 ? '.expanded-profile-page' : props.step >= 5 ? voice.value ? '.ice-voice-page' : '.ice-text-page' : props.step >= 3 ? '.ice-select-page' : '.discover-request-deck')
const message = computed(() => [props.error, props.blockedReason].filter(Boolean).join(' '))
defineExpose({ remeasure: () => spotlight.value?.remeasure() })
</script>

<template>
  <SpotlightGuide ref="spotlight" kind="discover" interaction-prefix="discoverGuide" :open="open" :step="step" :busy="busy" :error="message" :steps="steps" :targets="targets" :scope-selector="scope" :next-disabled="nextDisabled" :interactive-target="step === 3 || step === 4" :data-guide-user="targetUserId" @next="emit('next')" @back="emit('back')" @skip="emit('skip')" @relayout="emit('relayout', $event)" />
</template>
