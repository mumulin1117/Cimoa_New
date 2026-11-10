<script setup>
import { get_locale } from '@/i18n/index.js'

import { computed, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { profile_destination, require_profile_destination_ready } from '@/utils/profileNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import { bio_style } from '@/utils/profilePresentation.js'
import { use_account_scope } from '@/composables/useAccountScope.js'

const store = use_app_store(), frame = ref(null), navigating = ref(false), navigation_error = ref('')
const user = computed(() => store.current_user)
const { access_error } = use_account_scope(store)
const target = kind => { try { return profile_destination(store, kind) } catch { return '' } }
const navigate = async kind => {
  if (navigating.value) return
  if (kind !== 'back' && access_error.value) { navigation_error.value = access_error.value; return }
  navigating.value = true; navigation_error.value = ''
  try {
    if (kind === 'back') await frame.value.navigate_back()
    else await frame.value.navigate_forward(require_profile_destination_ready(profile_destination(store, kind)))
  } catch (error) { navigation_error.value = error.message } finally { navigating.value = false }
}
onHide(() => { navigation_error.value = '' })
</script>

<template>
  <SecondaryPageFrame ref="frame">
    <template #header>
      <view class="profile-header">
        <view class="profile-toolbar">
          <view class="profile-tool" role="button" tabindex="0" aria-label="Back" :aria-disabled="navigating" data-interaction="profile.goBack.click.1" @click="navigate('back')" @keydown.enter="navigate('back')" @keydown.space.prevent="navigate('back')"><view class="profile-back-icon"><SourceIcon name="back" /></view></view>
          <text class="profile-title">My profile</text>
          <view class="profile-tool" role="button" tabindex="0" aria-label="Open settings" :aria-disabled="navigating" data-interaction="profile.openAppSettings.click.1" :data-target="target('settings')" @click="navigate('settings')" @keydown.enter="navigate('settings')" @keydown.space.prevent="navigate('settings')"><view class="profile-settings-icon"><SourceIcon name="settings" /></view></view>
        </view>
        <FeedbackToast v-if="navigation_error" :message="navigation_error" @dismiss="navigation_error = String()" />
      </view>
    </template>
    <view class="profile-content">
      <view v-if="store.hydration_status === 'loading' || store.hydration_status === 'idle'" class="profile-state" role="status">Loading your profile…</view>
      <view v-else-if="store.hydration_status === 'error'" class="profile-state" role="alert"><text>Your profile couldn’t be loaded.</text><text>{{ store.hydration_error }}</text><view class="profile-retry" role="button" tabindex="0" data-interaction="profile.retry.click.1" @click="store.hydrate()" @keydown.enter="store.hydrate()" @keydown.space.prevent="store.hydrate()">Retry</view></view>
      <view v-else-if="access_error" class="profile-state" role="alert"><text>{{ access_error }}</text></view>
      <template v-else>
        <view class="profile-intro">
          <view class="profile-avatar"><ProfilePhoto :src="user.avatar_url" :name="user.user_name" portrait retry-interaction="profile.retryPhoto.click.1" /></view>
          <view class="profile-name-row"><text class="profile-name">{{ user.user_name }}{{ user.age ? `, ${user.age}` : '' }}</text><view v-if="user.verified" class="profile-verified" role="img" aria-label="Verified student"><SourceIcon name="verified" :stroke-width="2.6" /></view></view>
          <view class="profile-tags">
            <view class="profile-tag"><view class="profile-tag-icon"><SourceIcon name="university" :stroke-width="2" /></view><text>{{ user.university || 'University not shared' }}</text></view>
            <view class="profile-tag"><view class="profile-tag-icon"><SourceIcon name="book" :stroke-width="2" /></view><text>{{ user.major || 'Major not shared' }}</text></view>
            <view class="profile-tag"><view class="profile-tag-icon"><SourceIcon name="puzzle" :stroke-width="2" /></view><text>{{ user.mbti || 'MBTI not shared' }}</text></view>
          </view>
          <view class="profile-edit" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="profile.openEditBasic.click.1" :data-target="target('edit')" @click="navigate('edit')" @keydown.enter="navigate('edit')" @keydown.space.prevent="navigate('edit')"><view class="profile-edit-icon"><SourceIcon name="edit" :stroke-width="2.2" /></view><text>Edit Profile</text></view>
        </view>
        <view class="profile-card profile-about"><text class="profile-section-title">About me</text><text v-if="user.bio" class="profile-bio" :style="bio_style(user.bio_font)">{{ user.bio }}</text><text v-else class="profile-empty">No introduction yet.</text></view>
        <view class="profile-card"><text class="profile-section-title">Interests</text><view v-if="store.current_interests.length" class="profile-interests"><view v-for="interest in store.current_interests" :key="interest.item_id" class="profile-interest"><view class="interest-icon">{{ interest.emoji }}</view><text class="interest-label">{{ interest.label }}</text></view></view><text v-else class="profile-empty">No interests selected yet.</text></view>
        <view class="profile-card profile-link" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="profile.openStore.click.1" :data-target="target('coins')" @click="navigate('coins')" @keydown.enter="navigate('coins')" @keydown.space.prevent="navigate('coins')"><image class="profile-coin" src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><text class="profile-balance">{{ store.coin_balance.toLocaleString(get_locale()) }} coins</text><view class="profile-chevron"><SourceIcon name="chevron" /></view></view>
        <view class="profile-card profile-link" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="profile.openVerification.click.1" :data-target="target('verification')" @click="navigate('verification')" @keydown.enter="navigate('verification')" @keydown.space.prevent="navigate('verification')"><view class="profile-preview-icon"><view><SourceIcon :name="user.verified ? 'verified' : 'shield'" /></view></view><text class="profile-preview-label">University verification · {{ user.verified ? 'Active' : 'Pending' }}</text><view class="profile-chevron"><SourceIcon name="chevron" /></view></view>
        <view class="profile-card profile-link" role="button" tabindex="0" :aria-disabled="navigating" data-interaction="profile.openProfilePreview.click.1" :data-target="target('preview')" @click="navigate('preview')" @keydown.enter="navigate('preview')" @keydown.space.prevent="navigate('preview')"><view class="profile-preview-icon"><view><SourceIcon name="person" :stroke-width="1.9" /></view></view><text class="profile-preview-label">Preview my profile</text><view class="profile-chevron"><SourceIcon name="chevron" /></view></view>
      </template>
    </view>
    <template #footer><view class="profile-bottom-space" aria-hidden="true" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.profile-header { padding: 7.634rpx 38.168rpx 22.901rpx; }
.profile-toolbar { position: relative; height: 91.603rpx; display: flex; align-items: center; justify-content: space-between; }
.profile-tool {
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
.profile-back-icon { width: 41.985rpx; height: 41.985rpx; }
.profile-settings-icon { width: 40.076rpx; height: 40.076rpx; }
.profile-title {
  position: absolute;
  inset: 0 110.687rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 40.076rpx;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.15;
  pointer-events: none;
}
.profile-feedback {
  display: block;
  margin-top: 15.267rpx;
  font-size: 26.718rpx;
  line-height: 1.4;
  color: var(--cimoa-status-danger);
  overflow-wrap: anywhere;
}
.profile-content { padding: 0 38.168rpx 76.336rpx; }
.profile-intro { display: flex; flex-direction: column; align-items: center; gap: 19.084rpx; }
.profile-avatar {
  position: relative;
  width: 229.008rpx;
  height: 229.008rpx;
  border-radius: 114.504rpx;
  overflow: hidden;
  border: 3px solid var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-profile-avatar);
  flex: none;
}
.profile-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13.359rpx;
  margin-top: 7.634rpx;
  max-width: 100%;
}
.profile-name {
  font-size: 51.527rpx;
  font-weight: 800;
  letter-spacing: -0.03em;
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: center;
}
.profile-verified { width: 38.168rpx; height: 38.168rpx; flex: none; }
.profile-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 11.45rpx;
  max-width: 100%;
  padding: 0 30.534rpx;
}
.profile-tag {
  display: flex;
  align-items: center;
  gap: 7.634rpx;
  min-height: 57.252rpx;
  padding: 7.634rpx 19.084rpx;
  border-radius: 28.626rpx;
  min-width: 0;
  max-width: 100%;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-profile-tag);
}
.profile-tag-icon { width: 24.809rpx; height: 24.809rpx; flex: none; }
.profile-tag text { font-size: 24.809rpx; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; min-width: 0; }
.profile-edit {
  min-height: 91.603rpx;
  padding: 0 49.618rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-gradient-card-fill) padding-box, var(--cimoa-gradient-primary) border-box;
  border: 2px solid var(--cimoa-surface-transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 19.084rpx;
  gap: 15.267rpx;
}
.profile-edit-icon { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-link); }
.profile-edit text {
  font-size: 32.443rpx;
  font-weight: 700;
  background: var(--cimoa-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  color: var(--cimoa-surface-transparent);
}
.profile-card { margin-top: 30.534rpx; padding: 34.351rpx; background: var(--cimoa-surface-card); border-radius: 45.802rpx; box-shadow: var(--cimoa-shadow-card); }
.profile-about { margin-top: 41.985rpx; }
.profile-section-title { display: block; font-size: 41.985rpx; font-weight: 800; letter-spacing: -0.02em; }
.profile-bio {
  display: block;
  font-family: 'Caveat', cursive;
  font-size: 51.527rpx;
  font-weight: 600;
  line-height: 1.25;
  color: var(--cimoa-text-profile-bio);
  margin-top: 15.267rpx;
  text-align: center;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.profile-interests { display: flex; flex-wrap: wrap; gap: 34.351rpx; margin-top: 26.718rpx; }
.profile-interest { display: flex; flex-direction: column; align-items: center; gap: 15.267rpx; width: 141.221rpx; }
.interest-icon {
  width: 106.87rpx;
  height: 106.87rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-profile-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 45.802rpx;
}
.interest-label { font-size: 27.672rpx; font-weight: 600; text-align: center; overflow-wrap: normal; max-width: 100%; }
.profile-link { display: flex; align-items: center; gap: 26.718rpx; padding: 30.534rpx 34.351rpx; cursor: pointer; }
.profile-coin { width: 76.336rpx; height: 76.336rpx; flex: none; }
.profile-balance {
  flex: 1;
  min-width: 0;
  font-size: 36.26rpx;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.profile-chevron { width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-text-profile-chevron); flex: none; }
.profile-preview-icon {
  width: 76.336rpx;
  height: 76.336rpx;
  border-radius: 38.168rpx;
  background: var(--cimoa-surface-profile-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cimoa-text-profile-icon);
  flex: none;
}
.profile-preview-icon > view { width: 36.26rpx; height: 36.26rpx; }
.profile-preview-label { flex: 1; min-width: 0; font-size: 32.443rpx; font-weight: 700; overflow-wrap: anywhere; }
.profile-bottom-space { flex: none; height: 76.336rpx; }
.profile-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22.901rpx;
  margin: 38.168rpx 0;
  color: var(--cimoa-text-secondary);
  text-align: center;
  font-size: 30.534rpx;
}
.profile-empty { display: block; margin-top: 22.901rpx; color: var(--cimoa-text-secondary); font-size: 28.626rpx; }
.profile-retry { padding: 19.084rpx 38.168rpx; border-radius: 45.802rpx; color: var(--cimoa-text-inverse); background: var(--cimoa-button-primary); cursor: pointer; }
</style>
