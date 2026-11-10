<script setup>
import { computed, ref } from 'vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
const frame = ref(null), { store, error, access_error, is_loading, submit, back, recover } = use_profile_editor(frame, '/pages/profile/edit')
const draft = ref(store.match_preferences)
const groups = computed(() => store.profile_preference_groups(draft.value))
const select = option => { if (!is_loading.value && !access_error.value) Object.assign(draft.value, option.patch) }
const save = () => {
  if (!draft.value || access_error.value || is_loading.value) return
  const { owner_user_id, ...patch } = draft.value
  submit(() => store.update_match_preferences(patch), 'Preferences updated')
}
</script>
<template>
  <ProfileEditorFrame ref="frame" class="profile-preferences-page" title="Preferences" source="editPrefs" save action-interaction="editPrefs.savePrefs.click.1" :busy="is_loading" :error="error" @dismiss-error="error = String()" :access-error="access_error" loading-label="Updating your preferences…" @back="back" @recover="recover" @save="save">
    <text class="preferences-copy">These shape recommendations. They never guarantee a result and are never shown publicly.</text>
    <view class="preferences-groups"><view v-for="group in groups" :key="group.title"><text class="preferences-title">{{ group.title }}</text><view class="preferences-options" role="radiogroup" :aria-label="group.title"><view v-for="option in group.options" :key="option.label" class="preferences-chip" :class="{ selected: option.selected }" role="radio" tabindex="0" :aria-checked="option.selected" :aria-disabled="is_loading" data-interaction="editPrefs.o.pick.click.1" @click="select(option)" @keydown.enter="select(option)">{{ option.label }}</view></view></view></view>
  </ProfileEditorFrame>
</template>
<style scoped>
.preferences-copy { display: block; font-size: 30.534rpx; color: var(--cimoa-text-secondary); text-wrap: pretty; }
.preferences-groups { display: flex; flex-direction: column; gap: 38.168rpx; margin-top: 30.534rpx; }
.preferences-title { font-size: 32.443rpx; font-weight: 700; letter-spacing: -.015em; }
.preferences-options { display: flex; flex-wrap: wrap; gap: 19.084rpx; margin-top: 19.084rpx; }
.preferences-chip {
  min-height: 87.786rpx;
  padding: 0 32.443rpx;
  border-radius: 43.893rpx;
  display: flex;
  align-items: center;
  font-size: 30.534rpx;
  font-weight: 600;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-profile-preference);
  cursor: pointer;
}
.preferences-chip.selected { background: var(--cimoa-gradient-primary); color: var(--cimoa-text-inverse); }
</style>
