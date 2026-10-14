<script setup>
import { ref, watch } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { bio_style, bio_font_label } from '@/utils/profilePresentation.js'
import OnboardingSheet from './OnboardingSheet.vue'
const props = defineProps({ open: Boolean, bio: String, font: String })
const emit = defineEmits(['close', 'done']), store = use_app_store(), text = ref(''), font = ref('system'), mode = ref('text'), error = ref('')
watch(() => props.open, open => { if (open) { text.value = props.bio || ''; font.value = props.font || 'system'; mode.value = 'text'; error.value = '' } })
const done = () => { if (mode.value === 'voice') { error.value = 'No playable voice bio is available. Switch to Text to save your introduction.'; return } emit('done', { bio: text.value, bio_font: font.value }) }
</script>
<template>
  <OnboardingSheet class="profile-bio-dialog" :open="open" label="Edit bio" @close="emit('close')">
    <view class="bio-heading"><text>Edit bio</text><view role="button" aria-label="Close bio editor" data-interaction="editAll.eaClose.click.8" @click="emit('close')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M6 6l12 12M18 6 6 18" /></svg></view></view>
    <view class="bio-tabs"><view v-for="tab in ['text', 'voice']" :key="tab" role="button" :aria-pressed="mode === tab" :class="{ active: mode === tab }" :data-interaction="`editAll.eaBio${tab === 'text' ? 'Text' : 'Voice'}.click.1`" @click="mode = tab; error = ''">{{ tab === 'text' ? 'Text' : 'Voice' }}</view></view>
    <template v-if="mode === 'text'"><textarea v-model="text" class="bio-text" :style="bio_style(font)" aria-label="Profile bio" :maxlength="300" data-interaction="editAll.onEaBio.change.1" /><scroll-view scroll-x class="bio-fonts"><view class="bio-font-row"><view v-for="item in store.profile_catalog.bio_fonts" :key="item" role="button" :style="bio_style(item)" :class="{ active: font === item }" data-interaction="editAll.f.pick.click.1" @click="font = item">{{ bio_font_label(item) }}</view></view></scroll-view><text class="editor-copy">{{ text.length }}/300</text></template>
    <view v-else class="bio-voice"><view class="bio-record" role="button" aria-label="Record voice bio" data-interaction="editAll.evStart.click.1" @click="error = 'Voice bio recording has not been connected to this editor yet. No audio was recorded or saved.'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></view><text class="editor-copy">Tap to record a 30-second voice bio</text></view>
    <text v-if="error" class="bio-error" role="alert">{{ error }}</text><view class="editor-save bio-done" role="button" data-interaction="editAll.eaBioDone.click.1" @click="done">Done</view>
  </OnboardingSheet>
</template>
<style scoped>
.profile-bio-dialog :deep(.event-dialog-panel) {
  left: 30.534rpx;
  right: 30.534rpx;
  bottom: auto;
  top: calc(var(--app-safe-top, 0px) + 114.504rpx);
  border-radius: 61.069rpx;
  padding: 41.985rpx 38.168rpx;
  transform: translateY(26.718rpx);
}
.profile-bio-dialog :deep(.event-dialog--open .event-dialog-panel) { transform: translateY(0); }
.profile-bio-dialog :deep(.event-dialog-handle) { display: none; }
.bio-heading { display: flex; align-items: center; justify-content: space-between; font-size: 43.893rpx; font-weight: 800; }
.bio-heading > view {
  width: 76.336rpx;
  height: 76.336rpx;
  padding: 22.901rpx;
  background: var(--cimoa-surface-tinted);
  border-radius: 38.168rpx;
  cursor: pointer;
}
.bio-heading svg, .bio-record svg { width: 100%; height: 100%; }
.bio-tabs {
  display: flex;
  padding: 7.634rpx;
  background: var(--cimoa-surface-event-divider);
  border-radius: 45.802rpx;
  margin: 30.534rpx auto;
  max-width: 458.015rpx;
}
.bio-tabs > view {
  flex: 1;
  padding: 19.084rpx;
  border-radius: 38.168rpx;
  text-align: center;
  font-size: 30.534rpx;
  cursor: pointer;
}
.bio-text { height: 286.26rpx; width: 100%; text-align: center; font-size: 51.527rpx; line-height: 1.25; }
.bio-font-row { display: flex; gap: 15.267rpx; }
.bio-font-row > view {
  flex: none;
  padding: 19.084rpx 30.534rpx;
  border: 1px solid var(--cimoa-surface-border);
  border-radius: 40.076rpx;
  font-size: 32.443rpx;
  cursor: pointer;
}
.active { background: var(--cimoa-gradient-primary); color: var(--cimoa-text-inverse); }
.bio-done { margin: 34.351rpx auto 0; width: 362.595rpx; min-height: 103.053rpx; }
.bio-error { display: block; color: var(--cimoa-status-danger); margin-top: 19.084rpx; font-size: 28.626rpx; }
.bio-voice {
  min-height: 438.931rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 26.718rpx;
}
.bio-record {
  width: 160.305rpx;
  height: 160.305rpx;
  padding: 47.71rpx;
  border-radius: 80.153rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  cursor: pointer;
}
</style>
