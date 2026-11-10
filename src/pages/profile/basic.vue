<script setup>
import { computed, ref } from 'vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
const frame = ref(null), { store, context, account_id, error, access_error, is_loading, go, back, recover, submit } = use_profile_editor(frame, '/pages/profile/edit')
const draft = ref(Object.fromEntries(['user_name', 'pronouns', 'year', 'major'].map(key => [key, context.value?.user[key] || ''])))
const custom = ref(!!draft.value.pronouns && !store.onboarding_catalog.pronouns.includes(draft.value.pronouns))
const catalog = computed(() => store.onboarding_catalog)
const save = () => { error.value = store.profile_validation_error('basic', draft.value); if (!error.value) submit(() => store.save_profile_section('basic', draft.value, account_id)) }
</script>
<template>
  <ProfileEditorFrame ref="frame" class="profile-basic-page" title="Basic info" source="editBasic" save :busy="is_loading" :error="error" @dismiss-error="error = String()" :access-error="access_error" @back="back" @recover="recover" @save="save">
    <text class="editor-label">Display name</text><input v-model="draft.user_name" class="editor-input" aria-label="Display name" :maxlength="50" data-interaction="editBasic.onObName.change.1" />
    <text class="basic-title">Pronouns</text><view class="editor-chips"><view v-for="option in catalog.pronouns" :key="option" class="editor-chip" :class="{ selected: option === 'Add your own' ? custom : !custom && draft.pronouns === option }" role="button" data-interaction="editBasic.o.pick.click.1" @click="custom = option === 'Add your own'; draft.pronouns = custom ? '' : option">{{ option }}</view></view><input v-if="custom" v-model="draft.pronouns" class="editor-input custom-pronouns" aria-label="Your pronouns" :maxlength="50" placeholder="Your pronouns" />
    <text class="basic-title">Academic year</text><view class="editor-chips"><view v-for="option in catalog.years" :key="option" class="editor-chip" :class="{ selected: draft.year === option }" role="button" data-interaction="editBasic.o.pick.click.2" @click="draft.year = option">{{ option }}</view></view>
    <text class="editor-label">Field of study</text><input v-model="draft.major" class="editor-input" aria-label="Field of study" :maxlength="100" data-interaction="editBasic.onObField.change.1" />
    <view class="basic-notice"><text>Your university and date of birth aren’t editable here. If either needs correcting, contact support.</text><view role="button" data-interaction="editBasic.openSetSupport.click.1" @click="go('/pages/settings/support')">Contact support</view></view>
  </ProfileEditorFrame>
</template>
<style scoped>
.editor-label:first-child { margin-top: 0; }
.basic-title { display: block; margin-top: 38.168rpx; font-size: 32.443rpx; font-weight: 700; }
.editor-chip { min-height: 87.786rpx; padding: 15.267rpx 32.443rpx; font-size: 30.534rpx; }
.basic-notice { margin-top: 38.168rpx; padding: 34.351rpx; border-radius: 41.985rpx; background: var(--cimoa-surface-empty); font-size: 29.58rpx; line-height: 1.5; color: var(--cimoa-text-auth-legal); }
.basic-notice > view { color: var(--cimoa-text-link); margin-top: 15.267rpx; font-weight: 700; cursor: pointer; }
.custom-pronouns { margin-top: 19.084rpx; }
</style>
