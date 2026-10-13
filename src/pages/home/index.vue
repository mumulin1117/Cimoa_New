<script setup>
import { ref, computed, getCurrentInstance, onUnmounted } from 'vue'
import { onHide, onResize } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { switch_tab_route } from '@/utils/routeTransition.js'
import { home_destination, require_home_destination_ready } from '@/utils/homeNavigation.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CimoaBrand from '@/components/CimoaBrand.vue'
import ConnectionGoalsPopover from '@/components/ConnectionGoalsPopover.vue'

const store = use_app_store(), instance = getCurrentInstance(), frame = ref(null)
const goal_user_id = ref(''), anchor = ref(null), navigation_error = ref(''), navigating = ref(false)
const cards = computed(() => store.home_connections)
const match_card = computed(() => store.home_match_card)
let selection = 0
const close_goals = () => { selection++; goal_user_id.value = ''; anchor.value = null }
const open_goals = (user_id) => {
  if (goal_user_id.value === user_id) { close_goals(); return }
  const token = ++selection
  uni.createSelectorQuery().in(instance.proxy).select(`#connection-${user_id}`).boundingClientRect().select('.home-header').boundingClientRect().select('.home-content').boundingClientRect().exec((rects) => {
    if (selection !== token || !store.user_by_id(user_id) || !rects[0]) return
    const info = uni.getWindowInfo()
    // Bottom boundary is the shared scroll viewport, not a second safe-area padding.
    uni.createSelectorQuery().select('.main-tab-scroll').boundingClientRect((scroll) => {
      if (selection !== token) return
      anchor.value = { ...rects[0], limit_top: rects[1]?.bottom || 0, limit_bottom: scroll?.bottom || info.windowHeight }
      goal_user_id.value = user_id
    }).exec()
  })
}
const target = (kind, id) => { try { return home_destination(store, kind, id) } catch { return '' } }
const navigate = async (kind, id) => {
  if (navigating.value) return
  close_goals(); navigation_error.value = ''; navigating.value = true
  try {
    const url = require_home_destination_ready(home_destination(store, kind, id))
    if (kind === 'discover') await switch_tab_route(url)
    else await frame.value.navigate_forward(url)
  } catch (error) { navigation_error.value = error.message } finally { navigating.value = false }
}
const card_id = (card) => card.kind === 'connected' ? 'home.openMaya.click.1' : card.kind === 'auto_match' ? 'home.openLiam.click.1' : 'home.openJordan.click.1'
const goal_id = (card) => card.kind === 'connected' ? 'home.popMaya.click.1' : card.kind === 'auto_match' ? 'home.popLiam.click.1' : 'home.popJordan.click.1'
const status_label = (kind) => ({ connected: 'Connected', auto_match: 'Auto Match', invite: 'Invite' })[kind]
onHide(close_goals)
onResize(close_goals)
onUnmounted(close_goals)
</script>

<template>
  <MainTabFrame ref="frame" route="pages/home/index" @scroll="close_goals">
    <template #header>
      <view class="home-header">
        <view class="home-toolbar">
          <view class="home-profile" role="button" aria-label="Open profile" :aria-disabled="navigating" data-interaction="home.openMe.click.1" :data-target="target('profile')" @click="navigate('profile')"><view class="profile-icon"><SourceIcon name="person" /></view></view>
          <CimoaBrand />
          <view class="home-match" role="button" aria-label="Start Auto Match" :aria-disabled="navigating" data-interaction="home.startAutoMatch.click.1" :data-target="target('match')" @click="navigate('match')">
            <view class="flash-icon"><SourceIcon name="lightning" /></view>
            <text v-if="store.free_matches_remaining > 0" class="quota-badge" :aria-label="`${store.free_matches_remaining} free matches remaining`">{{ store.free_matches_remaining }}</text>
            <image v-else-if="store.session.is_authenticated" class="coin-badge" src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" aria-label="Paid matching after daily free quota" />
          </view>
        </view>
        <text class="home-title">People you’ve met</text>
        <text class="home-subtitle">Keep in touch and see what’s next.</text>
        <text v-if="navigation_error" class="home-error" role="alert">{{ navigation_error }}</text>
      </view>
    </template>
    <view class="home-content">
      <view v-if="store.hydration_status === 'error'" class="home-empty home-read-error">
        <text class="empty-title">Your connections couldn’t be loaded.</text><text class="empty-copy">{{ store.hydration_error }}</text>
        <view class="home-secondary" role="button" data-interaction="home.retry.click.1" @click="store.hydrate()">Retry</view>
      </view>
      <view v-else-if="!store.session.is_authenticated" class="home-empty"><text class="empty-title">Your session has expired.</text><text class="empty-copy">Please sign in again to view your connections.</text></view>
      <template v-else>
        <template v-if="!cards.length">
          <view class="home-empty"><text class="empty-title">Your new connections will appear here.</text><text class="empty-copy">Join the matching pool or browse people on your campus to get started.</text></view>
          <view class="empty-actions">
            <view class="home-primary" role="button" :aria-disabled="navigating" data-interaction="home.startAutoMatch.click.2" :data-target="target('match')" @click="navigate('match')"><view class="empty-flash"><SourceIcon name="lightning" /></view><text>Start Auto Match</text></view>
            <view class="home-secondary" role="button" data-interaction="home.exploreDiscover.click.1" :data-target="target('discover')" @click="navigate('discover')">Explore People</view>
          </view>
        </template>
        <view v-else class="connections">
          <view v-for="card in cards" :id="`connection-${card.user_id}`" :key="card.user_id" class="connection" role="button" :aria-disabled="navigating" :data-interaction="card_id(card)" :data-target="target('card', card.user_id)" @click="navigate('card', card.user_id)">
            <view class="connection-portrait"><view class="connection-avatar"><UserAvatar :src="card.user.avatar_url" :name="card.user.user_name" /></view><text class="connection-status" :class="`connection-status--${card.kind}`">{{ status_label(card.kind) }}</text></view>
            <view class="connection-info">
              <view class="connection-heading"><text class="connection-name">{{ card.user.user_name }}{{ card.user.age ? `, ${card.user.age}` : '' }}</text><view class="connection-chevron"><SourceIcon name="chevron" /></view></view>
              <view class="connection-tags">
                <view class="university-tag"><view class="tag-icon"><SourceIcon name="university" /></view><text>{{ card.user.university || 'University not shared' }}</text></view>
                <view class="goals-tag" role="button" :aria-label="`View ${card.user.user_name}’s connection goals`" :aria-expanded="goal_user_id === card.user_id" :data-interaction="goal_id(card)" @click.stop="open_goals(card.user_id)"><view class="tag-icon"><SourceIcon name="goal-search" /></view><text>{{ card.goals.slice(0, 3).map(goal => goal.emoji).join('') || 'Goals' }}</text></view>
              </view>
            </view>
          </view>
        </view>
        <view v-if="match_card" class="match-status" role="button" data-interaction="home.amCardGo.click.1" :data-target="target('status')" @click="navigate('status')"><view class="match-status-icon"><view><SourceIcon name="lightning" /></view></view><view class="match-status-copy"><text class="match-status-title">{{ match_card.title }}</text><text class="match-status-subtitle">{{ match_card.subtitle }}</text></view><text class="match-status-action">{{ match_card.action }}</text></view>
      </template>
    </view>
    <template #overlays><ConnectionGoalsPopover :user-id="goal_user_id" :anchor="anchor" @close="close_goals" /></template>
  </MainTabFrame>
</template>

<style scoped>
.home-header { padding: 11.45rpx 38.168rpx 0; }
.home-toolbar { display: flex; align-items: flex-start; justify-content: space-between; }
.home-profile, .home-match {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 103.053rpx;
  height: 103.053rpx;
  border-radius: 50%;
}
.home-profile { background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); }
.profile-icon { width: 49.618rpx; height: 49.618rpx; }
.home-match { background: var(--cimoa-gradient-lightning); box-shadow: var(--cimoa-shadow-lightning); color: var(--cimoa-text-inverse); }
.flash-icon { width: 38.168rpx; height: 53.435rpx; }
.quota-badge {
  position: absolute;
  top: -7.634rpx;
  right: -7.634rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 45.802rpx;
  height: 45.802rpx;
  padding: 0 11.45rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-text-badge);
  box-shadow: var(--cimoa-shadow-badge);
  font-size: 24.809rpx;
  font-weight: 800;
}
.coin-badge {
  position: absolute;
  top: -7.634rpx;
  right: -7.634rpx;
  width: 45.802rpx;
  height: 45.802rpx;
  filter: drop-shadow(var(--cimoa-shadow-coin));
}
.home-title {
  display: block;
  margin-top: 49.618rpx;
  font-size: 72.519rpx;
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -.035em;
}
.home-subtitle { display: block; margin-top: 15.267rpx; font-size: 34.351rpx; color: var(--cimoa-text-secondary); letter-spacing: -.015em; }
.home-content { padding: 0 38.168rpx 38.168rpx; }
.connections { display: flex; flex-direction: column; gap: 26.718rpx; padding-top: 41.985rpx; }
.connection {
  position: relative;
  display: flex;
  align-items: center;
  gap: 26.718rpx;
  padding: 30.534rpx;
  border-radius: 49.618rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-card);
}
.connection-portrait { position: relative; flex: none; width: 148.855rpx; padding-bottom: 19.084rpx; }
.connection-avatar { width: 148.855rpx; height: 148.855rpx; border-radius: 50%; }
.connection-status {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  height: 45.802rpx;
  padding: 0 17.176rpx;
  border-radius: 22.901rpx;
  border: 2px solid var(--cimoa-surface-card);
  font-size: 22.901rpx;
  font-weight: 700;
}
.connection-status--connected { background: var(--cimoa-status-connected-bg); color: var(--cimoa-status-connected-ink); }
.connection-status--auto_match { background: var(--cimoa-gradient-match-badge); color: var(--cimoa-text-inverse); }
.connection-status--invite { background: var(--cimoa-status-invite-bg); color: var(--cimoa-status-invite-ink); }
.connection-info { flex: 1; min-width: 0; }
.connection-heading { display: flex; align-items: center; gap: 15.267rpx; }
.connection-name {
  flex: 1;
  min-width: 0;
  font-size: 38.168rpx;
  font-weight: 800;
  letter-spacing: -.025em;
  overflow-wrap: anywhere;
}
.connection-chevron { flex: none; width: 34.351rpx; height: 34.351rpx; }
.connection-tags { display: flex; flex-wrap: wrap; gap: 11.45rpx; margin-top: 19.084rpx; }
.university-tag, .goals-tag {
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  min-height: 72.519rpx;
  padding: 0 19.084rpx;
  border-radius: 36.26rpx;
  background: var(--cimoa-surface-tinted);
}
.university-tag { font-size: 28.626rpx; font-weight: 600; overflow-wrap: anywhere; max-width: 100%; }
.goals-tag { font-size: 32.443rpx; letter-spacing: 1.908rpx; }
.tag-icon { flex: none; width: 32.443rpx; height: 32.443rpx; }
.home-empty { margin-top: 64.885rpx; padding: 57.252rpx 41.985rpx; border-radius: 49.618rpx; background: var(--cimoa-surface-empty); text-align: center; }
.empty-title { display: block; font-size: 38.168rpx; font-weight: 700; }
.empty-copy { display: block; margin-top: 19.084rpx; font-size: 31.489rpx; line-height: 1.5; color: var(--cimoa-text-secondary); }
.empty-actions { margin-top: 41.985rpx; }
.home-primary, .home-secondary { display: flex; align-items: center; justify-content: center; }
.home-primary {
  min-height: 118.321rpx;
  border-radius: 59.16rpx;
  gap: 26.718rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-primary);
  font-size: 40.076rpx;
  font-weight: 700;
  letter-spacing: -.01em;
}
.empty-flash { width: 38.168rpx; height: 49.618rpx; }
.home-secondary {
  min-height: 106.87rpx;
  margin-top: 22.901rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-explore);
  font-size: 34.351rpx;
  font-weight: 600;
}
.home-error { display: block; margin-top: 15.267rpx; color: var(--cimoa-status-danger); font-size: 26.718rpx; line-height: 1.4; }
.match-status {
  display: flex;
  align-items: center;
  gap: 26.718rpx;
  margin-top: 45.802rpx;
  padding: 34.351rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-match-card);
}
.match-status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 99.237rpx;
  height: 99.237rpx;
  border-radius: 50%;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
}
.match-status-icon > view { width: 32.443rpx; height: 41.985rpx; }
.match-status-copy { flex: 1; min-width: 0; }
.match-status-title { display: block; font-size: 34.351rpx; font-weight: 800; letter-spacing: -.02em; }
.match-status-subtitle { display: block; margin-top: 3.817rpx; font-size: 27.672rpx; color: var(--cimoa-text-secondary); }
.match-status-action { flex: none; max-width: 110.687rpx; font-size: 28.626rpx; font-weight: 700; color: var(--cimoa-text-link); }
</style>
