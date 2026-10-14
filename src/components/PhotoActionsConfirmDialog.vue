<script setup>
import { ref, watch } from 'vue'
import OnboardingSheet from './OnboardingSheet.vue'
const props = defineProps({ open: Boolean, busy: Boolean, position: Number, count: Number, error: String, draft: Boolean })
const emit = defineEmits(['close', 'replace', 'action']), removing = ref(false)
watch(() => props.open, () => { removing.value = false })
</script>
<template>
  <OnboardingSheet :open="open" :busy="busy" label="Profile photo actions" @close="emit('close')">
    <text class="event-dialog-title">{{ removing ? 'Remove this photo?' : 'Profile photo' }}</text>
    <template v-if="removing"><text class="event-dialog-copy">{{ draft ? 'This removes the photo from your draft. Your published profile changes only after Save.' : 'This photo will no longer appear on your profile. You still need at least two photos to finish setup.' }}</text><view class="event-dialog-primary" role="button" tabindex="0" data-photo-action="confirm-remove" :aria-disabled="busy" @click="!busy && emit('action', 'remove')" @keydown.enter="!busy && emit('action', 'remove')">Remove Photo</view><view class="event-dialog-secondary" role="button" tabindex="0" @click="removing = false" @keydown.enter="removing = false">Keep Photo</view></template>
    <template v-else>
      <view class="event-dialog-primary" role="button" tabindex="0" :aria-disabled="busy" @click="!busy && emit('replace')" @keydown.enter="!busy && emit('replace')">Replace Photo</view>
      <view v-if="position > 0" class="event-dialog-secondary" role="button" tabindex="0" @click="!busy && emit('action', 'primary')" @keydown.enter="!busy && emit('action', 'primary')">Set as Primary</view>
      <view v-if="position > 0" class="event-dialog-secondary" role="button" tabindex="0" @click="!busy && emit('action', 'earlier')" @keydown.enter="!busy && emit('action', 'earlier')">Move Earlier</view>
      <view v-if="position < count - 1" class="event-dialog-secondary" role="button" tabindex="0" @click="!busy && emit('action', 'later')" @keydown.enter="!busy && emit('action', 'later')">Move Later</view>
      <view class="event-dialog-secondary event-dialog-danger" role="button" tabindex="0" @click="!busy && (removing = true)" @keydown.enter="!busy && (removing = true)">Remove Photo</view>
      <view class="event-dialog-secondary" role="button" tabindex="0" @click="emit('close')" @keydown.enter="emit('close')">Cancel</view>
    </template>
    <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text>
  </OnboardingSheet>
</template>
