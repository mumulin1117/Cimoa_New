<script setup>
import { computed, ref, watch } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { discover_destination, require_discover_destination_ready } from '@/utils/discoverNavigation.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import DiscoverHeroHeader from '@/components/DiscoverHeroHeader.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import SourceIcon from '@/components/SourceIcon.vue'

const store = use_app_store(), frame = ref(null), navigation_error = ref(''), navigating = ref(false)
const person = computed(() => store.discover_person)
// Layout only: preserve the source's compact one-line tags, wrap expanded labels.
const wrap_tags = computed(() => [person.value?.university, person.value?.major, person.value?.mbti].join('').length > 24)
const target = (kind, id) => { try { return discover_destination(store, kind, id) } catch { return '' } }
const navigate = async (kind, id) => {
  if (navigating.value) return
  navigating.value = true; navigation_error.value = ''; store.tick()
  try { await frame.value.navigate_forward(require_discover_destination_ready(discover_destination(store, kind, id))) }
  catch (error) { navigation_error.value = error.message }
  finally { navigating.value = false }
}
watch(() => person.value?.user_id, () => { navigation_error.value = '' })
</script>

<template>
  <MainTabFrame ref="frame" route="pages/discover/index" header-owns-safe-area>
    <template #header><DiscoverHeroHeader :profile-target="target('profile')" :preferences-target="target('preferences')" @profile="navigate('profile')" @preferences="navigate('preferences')" /></template>
    <view class="discover-content">
      <view v-if="store.hydration_status === 'error'" class="discover-state discover-read-error" role="alert"><text>{{ store.hydration_error }}</text><view class="discover-retry" role="button" tabindex="0" @click="store.hydrate" @keydown.enter="store.hydrate">Retry</view></view>
      <view v-else-if="store.hydration_status !== 'ready'" class="discover-state" role="status">Loading profiles…</view>
      <view v-else-if="!store.session.is_authenticated" class="discover-state discover-session-error" role="alert">Your session has expired. Please sign in again.</view>
      <view v-else-if="!person" class="discover-state discover-empty"><text>No profiles available right now.</text><text>Check back when more students are available.</text></view>
      <view v-else :key="person.user_id" class="discover-photo-card" role="button" tabindex="0" :aria-label="`View ${person.user_name}’s profile`" :data-user-id="person.user_id" data-interaction="photo.expand.click.1" :data-target="target('detail', person.user_id)" @click="navigate('detail', person.user_id)" @keydown.enter.self="navigate('detail', person.user_id)" @keydown.space.self.prevent="navigate('detail', person.user_id)">
        <ProfilePhoto :src="person.photo?.media_url || ''" :name="person.user_name" />
        <view class="discover-photo-scrim" />
        <view class="discover-info">
          <view class="discover-name-row"><text class="discover-name">{{ person.user_name }}{{ person.age === null ? '' : `, ${person.age}` }}</text><view v-if="person.verified" class="discover-verified" aria-label="Verified student"><SourceIcon name="verified" /></view></view>
          <view class="discover-tags" :class="{ 'discover-tags--wrap': wrap_tags }">
            <view v-if="person.university" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="university" /></view><text>{{ person.university }}</text></view>
            <view v-if="person.major" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="book" /></view><text>{{ person.major }}</text></view>
            <view v-if="person.mbti" class="discover-tag"><view class="discover-tag-icon"><SourceIcon name="puzzle" /></view><text>{{ person.mbti }}</text></view>
          </view>
        </view>
      </view>
    </view>
    <template #footer="{ ready }">
      <view class="discover-footer">
        <text v-if="navigation_error" class="discover-error" role="alert">{{ navigation_error }}</text>
        <view class="discover-send" role="button" tabindex="0" :aria-disabled="!ready || !person" data-interaction="photo.sayHi.click.1" :data-target="person ? target('icebreaker', person.user_id) : ''" @click="ready && person && navigate('icebreaker', person.user_id)" @keydown.enter="ready && person && navigate('icebreaker', person.user_id)" @keydown.space.prevent="ready && person && navigate('icebreaker', person.user_id)">Send shot</view>
      </view>
    </template>
  </MainTabFrame>
</template>

<style scoped>
.discover-content { padding: 0 38.168rpx; }
.discover-photo-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 1034.351rpx;
  box-sizing: border-box;
  overflow: hidden;
  padding: 610.687rpx 41.985rpx 30.534rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-deep);
  box-shadow: var(--cimoa-shadow-discover-photo);
  cursor: pointer;
}
.discover-photo-scrim {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 572.519rpx;
  background: var(--cimoa-gradient-photo-scrim);
  pointer-events: none;
}
.discover-info { position: relative; color: var(--cimoa-text-inverse); pointer-events: none; }
.discover-name-row { display: flex; align-items: center; gap: 19.084rpx; }
.discover-name { min-width: 0; font-size: 59.16rpx; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.discover-verified { flex: none; width: 49.618rpx; height: 49.618rpx; }
.discover-tags { display: flex; flex-wrap: nowrap; gap: 13.359rpx; margin-top: 22.901rpx; }
.discover-tags--wrap { flex-wrap: wrap; }
.discover-tag {
  flex: none;
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  min-height: 68.702rpx;
  max-width: 100%;
  padding: 0 22.901rpx;
  box-sizing: border-box;
  border: 1px solid var(--cimoa-surface-photo-tag-border);
  border-radius: 34.351rpx;
  background: var(--cimoa-surface-photo-tag);
  backdrop-filter: blur(15.267rpx);
  font-size: 28.626rpx;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.discover-tag text { min-width: 0; padding: 7.634rpx 0; }
.discover-tag-icon { flex: none; width: 30.534rpx; height: 30.534rpx; }
.discover-footer { flex: none; padding: 30.534rpx 38.168rpx 3.817rpx; }
.discover-send {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 114.504rpx;
  border-radius: 57.252rpx;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-primary);
  box-shadow: var(--cimoa-shadow-primary);
  font-size: 40.076rpx;
  font-weight: 700;
  cursor: pointer;
}
.discover-send[aria-disabled="true"] { opacity: 0.5; cursor: default; }
.discover-error { display: block; margin-bottom: 19.084rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; overflow-wrap: anywhere; }
.discover-state {
  display: flex;
  flex-direction: column;
  gap: 22.901rpx;
  padding: 45.802rpx;
  border-radius: 45.802rpx;
  color: var(--cimoa-text-secondary);
  background: var(--cimoa-surface-empty);
  font-size: 30.534rpx;
  line-height: 1.5;
}
.discover-retry { color: var(--cimoa-text-link); font-weight: 700; cursor: pointer; }
</style>
