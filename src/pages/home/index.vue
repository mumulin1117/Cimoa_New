<script setup>
import { Teleport, ref, computed, watch, getCurrentInstance, onUnmounted, nextTick } from 'vue'
import { onHide, onShow, onResize } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { switch_tab_route } from '@/utils/routeTransition.js'
import { home_destination, require_home_destination_ready } from '@/utils/homeNavigation.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CimoaBrand from '@/components/CimoaBrand.vue'
import BrandProgressMark from '@/components/BrandProgressMark.vue'
import ConnectionGoalsPopover from '@/components/ConnectionGoalsPopover.vue'
import AutoMatchGuide from '@/components/AutoMatchGuide.vue'
import ActionLoading from '@/components/ActionLoading.vue'
import { use_auto_match_guide } from '@/composables/useAutoMatchGuide.js'
import { create_content_refresh } from '@/utils/contentRefresh.js'
import { MOTION } from '@/config/navigation.js'
import { clear_match_ignition } from '@/utils/matchIgnition.js'
import { auto_match_surface } from '@/utils/sendSurface.js'
import { use_send_surface_source } from '@/composables/useSendSurface.js'
import { connection_visual_revision, take_connection_visuals } from '@/utils/connectionVisuals.js'
import { capture_avatar_relay, resume_home_avatar_relay, clear_avatar_relay } from '@/utils/avatarRelay.js'

const store = use_app_store(), instance = getCurrentInstance(), frame = ref(null)
const match_header = ref(null), match_cta = ref(null)
let match_anchor = null
const surface = use_send_surface_source({ controller: auto_match_surface, identity: () => ({ auth_context: store.auth_context, user_id: store.session.current_user_id }), element: () => frame.value?.$el || frame.value, anchor: () => match_anchor })
const goal_user_id = ref(''), anchor = ref(null), navigation_error = ref(''), navigating = ref(false)
const home = computed(() => store.home_feed)
const cards = computed(() => home.value.cards)
const match_card = computed(() => home.value.match_card)
const content_loading = ref(true)
const highlights = ref(new Set()), highlight_timers = new Map()
let home_visible = true
const clear_highlights = () => { for (const timer of highlight_timers.values()) clearTimeout(timer); highlight_timers.clear(); highlights.value = new Set() }
const reveal_connections = async () => {
  await nextTick()
  if (!home_visible || content_loading.value) return
  const ids = take_connection_visuals(store.auth_context, cards.value)
  if (!ids.length) return
  highlights.value = new Set([...highlights.value, ...ids])
  for (const id of ids) {
    clearTimeout(highlight_timers.get(id))
    highlight_timers.set(id, setTimeout(() => { const next = new Set(highlights.value); next.delete(id); highlights.value = next; highlight_timers.delete(id) }, MOTION.connection_glint))
  }
}
watch(connection_visual_revision, reveal_connections)
watch(content_loading, loading => { if (!loading) reveal_connections() })
onShow(() => {
  home_visible = true; reveal_connections()
  nextTick(() => { if (home_visible) resume_home_avatar_relay({ auth_context: store.auth_context, resolve: id => document.getElementById(`connection-${id}`)?.querySelector('.connection-avatar') }) })
})
onHide(() => { home_visible = false; clear_highlights() })
onUnmounted(() => { home_visible = false; clear_highlights() })
const refreshing = ref(false)
let refresh_context = ''
const refresh_task = create_content_refresh({ delay: MOTION.content_refresh, read: () => store.refresh_home_feed(refresh_context) })
const cancel_refresh = () => { refresh_task.cancel(); refreshing.value = false }
const refresh_home = async () => {
  if (refreshing.value || !['ready', 'empty'].includes(home.value.status)) return
  close_goals(); navigation_error.value = ''; refresh_context = store.auth_context; refreshing.value = true
  const result = await refresh_task.start()
  refreshing.value = false
  if (!result.success && result.reason !== 'cancelled') navigation_error.value = result.message
}
let selection = 0
const close_goals = () => { selection++; goal_user_id.value = ''; anchor.value = null }
const open_goals = (user_id) => {
  if (navigating.value || !cards.value.some(card => card.user_id === user_id)) return
  if (goal_user_id.value === user_id) { close_goals(); return }
  const token = ++selection
  uni.createSelectorQuery().in(instance.proxy).select(`#connection-${user_id}`).boundingClientRect().select(`#connection-${user_id} .goals-tag`).boundingClientRect().select('.home-header').boundingClientRect().exec((rects) => {
    if (selection !== token || !cards.value.some(card => card.user_id === user_id) || !rects[0]) return
    const info = uni.getWindowInfo()
    // Bottom boundary is the shared scroll viewport, not a second safe-area padding.
    uni.createSelectorQuery().select('.main-tab-scroll').boundingClientRect((scroll) => {
      if (selection !== token || !cards.value.some(card => card.user_id === user_id)) return
      anchor.value = { ...rects[0], trigger: rects[1], limit_top: rects[2]?.bottom || 0, limit_bottom: scroll?.bottom || info.windowHeight }
      goal_user_id.value = user_id
    }).exec()
  })
}
const target = (kind, id) => { try { return home_destination(store, kind, id) } catch { return '' } }
const navigate = async (kind, id, event) => {
  if (navigating.value) return false
  close_goals(); navigation_error.value = ''; navigating.value = true
  try {
    const url = require_home_destination_ready(home_destination(store, kind, id))
    if (kind === 'match') {
      const button = id === 'header' ? match_header.value : match_cta.value
      match_anchor = button?.$el || button
      clear_match_ignition()
      return await surface.navigate(store.session.current_user_id, () => frame.value.navigate_forward(url))
    }
    if (kind === 'card') {
      const card = cards.value.find(row => row.user_id === id), node = event?.currentTarget?.$el || event?.currentTarget
      if (card?.kind === 'connected') capture_avatar_relay({ user_id: id, conversation_id: card.conversation_id, avatar_src: card.user.avatar_url, element: node?.querySelector?.('.connection-avatar') || document.getElementById(`connection-${id}`)?.querySelector('.connection-avatar'), auth_context: store.auth_context })
    }
    if (kind === 'discover') await switch_tab_route(url)
    else await frame.value.navigate_forward(url)
    return true
  } catch (error) { clear_avatar_relay(); clear_match_ignition(); navigation_error.value = error.message; return false } finally { navigating.value = false }
}
const { open: guide_open, step: guide_step, busy: guide_busy, error: guide_error, is_loading: guide_loading, next: guide_next, back: guide_back, skip: guide_skip } = use_auto_match_guide('home', {
  ready: computed(() => !content_loading.value && ['ready', 'empty'].includes(home.value.status)),
  available: () => !refreshing.value && !navigating.value && !goal_user_id.value,
  open_entry: () => navigate('match', 'header'),
})
const card_id = (card) => card.kind === 'connected' ? 'home.openMaya.click.1' : card.kind === 'auto_match' ? 'home.openLiam.click.1' : card.kind === 'sent' ? 'home.openSentRequest.click.1' : card.kind === 'match_invite' ? 'home.openMatchInvitation.click.1' : 'home.openJordan.click.1'
const goal_id = (card) => card.kind === 'connected' ? 'home.popMaya.click.1' : card.kind === 'auto_match' ? 'home.popLiam.click.1' : 'home.popJordan.click.1'
watch(() => home.value.owner_user_id, () => { close_goals(); clear_highlights(); navigation_error.value = '' })
watch(() => store.auth_context, cancel_refresh)
watch(() => cards.value.some(card => card.user_id === goal_user_id.value), available => { if (goal_user_id.value && !available) close_goals() })
onHide(close_goals)
onHide(cancel_refresh)
onResize(close_goals)
onResize(clear_highlights)
onUnmounted(close_goals)
onUnmounted(cancel_refresh)
</script>

<template>
  <Teleport to="#cimoa-auto-match-surface-source" :disabled="!surface.borrowed.value">
  <MainTabFrame ref="frame" route="pages/home/index" pull-to-refresh :scroll-locked="guide_open" :style="{ '--press-in': `${MOTION.press_in}ms`, '--press-out': `${MOTION.press_out}ms`, '--connection-glint': `${MOTION.connection_glint}ms` }" :refreshing="refreshing" :refresh-enabled="['ready', 'empty'].includes(home.status)" @content-loading="content_loading = $event" @refresh="refresh_home" @scroll="close_goals">
    <template #header>
      <view class="home-header">
        <view class="home-toolbar">
          <view class="home-profile" role="button" tabindex="0" aria-label="Open profile" :aria-disabled="navigating" data-interaction="home.openMe.click.1" :data-target="target('profile')" @click="navigate('profile')" @keydown.enter="navigate('profile')"><view class="profile-icon"><SourceIcon name="person" /></view></view>
          <CimoaBrand />
          <view ref="match_header" class="home-match" role="button" tabindex="0" aria-label="Start Auto Match" :aria-disabled="navigating" :aria-busy="navigating" data-interaction="home.startAutoMatch.click.1" :data-target="target('match')" @click="navigate('match', 'header', $event)" @keydown.enter="navigate('match', 'header', $event)">
            <view class="flash-icon"><SourceIcon name="lightning" /></view>
            <text v-if="home.quota?.remaining > 0" class="quota-badge" :aria-label="`${home.quota?.remaining} free matches remaining`">{{ home.quota?.remaining }}</text>
            <image v-else-if="home.quota?.is_paid" class="coin-badge" src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" aria-label="Paid matching after daily free quota" />
          </view>
        </view>
        <text class="home-title">People you’ve met</text>
        <text class="home-subtitle">Keep in touch and see what’s next.</text>
        <FeedbackToast v-if="navigation_error" :message="navigation_error" @dismiss="navigation_error = String()" />
      </view>
    </template>
    <view class="home-content">
      <view v-if="home.status === 'loading'" class="home-empty" role="status" aria-busy="true"><view class="home-loading-mark"><BrandProgressMark /></view><text class="empty-copy">Loading your connections…</text></view>
      <view v-else-if="home.status === 'error'" class="home-empty home-read-error">
        <text class="empty-title">Your connections couldn’t be loaded.</text><text class="empty-copy">{{ home.error_message }}</text>
        <view class="home-secondary" role="button" tabindex="0" data-interaction="home.retry.click.1" @click="store.hydrate()" @keydown.enter="store.hydrate()">Retry</view>
      </view>
      <view v-else-if="home.status === 'session_expired'" class="home-empty"><text class="empty-title">Your session has expired.</text><text class="empty-copy">Please sign in again to view your connections.</text></view>
      <template v-else>
        <template v-if="!cards.length">
          <view class="home-empty"><text class="empty-title">Your new connections will appear here.</text><text class="empty-copy">Join the matching pool or browse people on your campus to get started.</text></view>
          <view class="empty-actions">
            <view ref="match_cta" class="home-primary" role="button" tabindex="0" :aria-disabled="navigating" :aria-busy="navigating" data-interaction="home.startAutoMatch.click.2" :data-target="target('match')" @click="navigate('match', 'cta', $event)" @keydown.enter="navigate('match', 'cta', $event)"><view class="empty-flash"><SourceIcon name="lightning" /></view><text>Start Auto Match</text></view>
            <view class="home-secondary" role="button" tabindex="0" data-interaction="home.exploreDiscover.click.1" :data-target="target('discover')" @click="navigate('discover')" @keydown.enter="navigate('discover')">Explore People</view>
          </view>
        </template>
        <view v-else class="connections">
          <view v-for="card in cards" :id="`connection-${card.user_id}`" :key="card.user_id" class="connection" :class="{ 'connection--new': highlights.has(card.user_id) }" data-press-glow role="button" tabindex="0" :aria-disabled="navigating" :data-interaction="card_id(card)" :data-target="target('card', card.user_id)" @click="navigate('card', card.user_id, $event)" @keydown.enter="navigate('card', card.user_id, $event)">
            <view class="connection-portrait"><view class="connection-avatar"><UserAvatar :src="card.user.avatar_url" :name="card.user.user_name" /></view><text class="connection-status" :class="`connection-status--${card.kind}`">{{ card.status_label }}</text></view>
            <view class="connection-info">
              <view class="connection-heading"><text class="connection-name">{{ card.user.user_name }}{{ card.user.age ? `, ${card.user.age}` : '' }}</text><view class="connection-chevron"><SourceIcon name="chevron" /></view></view>
              <view class="connection-tags">
                <view class="university-tag"><view class="tag-icon"><SourceIcon name="university" /></view><text>{{ card.user.university || 'University not shared' }}</text></view>
                <view class="goals-tag" role="button" tabindex="0" :aria-label="`View ${card.user.user_name}’s connection goals`" :aria-expanded="goal_user_id === card.user_id" :data-interaction="goal_id(card)" @click.stop="open_goals(card.user_id)" @keydown.enter.stop="open_goals(card.user_id)"><view class="tag-icon"><SourceIcon name="goal-search" /></view><text>{{ card.goals.slice(0, 3).map(goal => goal.emoji).join('') || 'Goals' }}</text></view>
              </view>
            </view>
          </view>
        </view>
        <view v-if="match_card" class="match-status" role="button" tabindex="0" data-interaction="home.amCardGo.click.1" :data-target="target('status')" @click="navigate('status')" @keydown.enter="navigate('status')"><view class="match-status-icon"><view><SourceIcon name="lightning" /></view></view><view class="match-status-copy"><text class="match-status-title">{{ match_card.title }}</text><text class="match-status-subtitle">{{ match_card.subtitle }}</text></view><text class="match-status-action">{{ match_card.action }}</text></view>
        <view v-if="cards.length" class="home-list-actions">
          <view ref="match_cta" class="home-primary" role="button" tabindex="0" :aria-disabled="navigating" :aria-busy="navigating" data-interaction="home.startAutoMatch.click.3" :data-target="target('match')" @click="navigate('match', 'cta', $event)" @keydown.enter="navigate('match', 'cta', $event)"><view class="empty-flash"><SourceIcon name="lightning" /></view><text>Start Auto Match</text></view>
        </view>
      </template>
    </view>
    <template #overlays>
      <ConnectionGoalsPopover :user-id="goal_user_id" :anchor="anchor" @close="close_goals" />
      <AutoMatchGuide :open="guide_open" :step="guide_step" :busy="guide_busy" :error="guide_error" @next="guide_next" @back="guide_back" @skip="guide_skip" />
      <ActionLoading :visible="guide_loading" label="Finishing your guide…" scope="auto-match-guide" />
    </template>
  </MainTabFrame>
  </Teleport>
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
  isolation: isolate;
  cursor: pointer;
  transition: transform var(--press-out) ease-out, box-shadow var(--press-out) ease-out;
}
.home-profile::after, .home-match::after {
  content: '';
  position: absolute;
  inset: -17.176rpx;
  z-index: -1;
  border-radius: 50%;
  background: var(--cimoa-gradient-main-control-aura);
  opacity: 0;
  transform: scale(.72);
  pointer-events: none;
  transition: opacity var(--press-out) ease-out, transform var(--press-out) ease-out;
}
.home-profile[data-touch-state='pressed'], .home-profile[data-touch-state='held'],
.home-match[data-touch-state='pressed'], .home-match[data-touch-state='held'] { transform: scale(.94); box-shadow: var(--cimoa-shadow-main-control-active); transition-duration: var(--press-in); }
.home-profile[data-touch-state='pressed']::after, .home-profile[data-touch-state='held']::after,
.home-match[data-touch-state='pressed']::after, .home-match[data-touch-state='held']::after { opacity: 1; transform: scale(1); transition-duration: var(--press-in); }
.home-profile[data-touch-state='pressed'] .profile-icon, .home-profile[data-touch-state='held'] .profile-icon { transform: rotate(-6deg); }
.home-match[data-touch-state='pressed'] .flash-icon, .home-match[data-touch-state='held'] .flash-icon { transform: rotate(7deg) scale(1.06); }
.home-profile { background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); }
.profile-icon { width: 49.618rpx; height: 49.618rpx; transition: transform var(--press-out) ease-out; }
.home-match { background: var(--cimoa-gradient-lightning); box-shadow: var(--cimoa-shadow-lightning); color: var(--cimoa-text-inverse); }
.flash-icon { width: 38.168rpx; height: 53.435rpx; transition: transform var(--press-out) ease-out; }
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
  isolation: isolate;
  overflow: clip;
  transition: transform var(--press-out) ease-out, box-shadow var(--press-out) ease-out;
}
.connection::before {
  content: '';
  position: absolute;
  left: var(--press-x, 50%);
  top: var(--press-y, 50%);
  width: 240rpx;
  height: 190rpx;
  z-index: -1;
  border-radius: inherit;
  background: var(--cimoa-gradient-press-glow);
  transform: translate(-50%, -50%);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--press-out) ease-out;
}
.connection[data-touch-state='pressed'], .connection[data-touch-state='held'] { transform: scale(.985); box-shadow: var(--cimoa-shadow-card-pressed); transition-duration: var(--press-in); }
.connection[data-touch-state='pressed']::before, .connection[data-touch-state='held']::before { opacity: 1; transition-duration: var(--press-in); }
.connection--new::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid var(--cimoa-surface-transparent);
  background: var(--cimoa-gradient-connection-glint) border-box;
  background-size: 250% 100%;
  mask: linear-gradient(var(--cimoa-surface-card) 0 0) padding-box, linear-gradient(var(--cimoa-surface-card) 0 0);
  mask-composite: exclude;
  pointer-events: none;
  animation: connection-light var(--connection-glint) ease-out both;
}
.connection--new .connection-status { animation: connection-label var(--press-out) ease-out both; }
@keyframes connection-light { from { opacity: 0; background-position: 140% 0; } 20% { opacity: 1; } to { opacity: 0; background-position: -40% 0; } }
@keyframes connection-label { from { opacity: .4; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .connection { transition-property: box-shadow; }
  .connection[data-touch-state='pressed'], .connection[data-touch-state='held'] { transform: none; }
  .connection--new::after { animation: connection-fade var(--press-out) ease-out both; background-size: 100% 100%; }
}
@keyframes connection-fade { from { opacity: .5; } to { opacity: 0; } }
.connection-portrait { position: relative; flex: none; width: 148.855rpx; padding-bottom: 19.084rpx; }
.connection-avatar { position: relative; width: 148.855rpx; height: 148.855rpx; border-radius: 50%; isolation: isolate; }
.connection-avatar::after {
  content: '';
  position: absolute;
  inset: -13.359rpx;
  z-index: -1;
  border-radius: 50%;
  background: var(--cimoa-gradient-main-control-aura);
  opacity: 0;
  transform: scale(.78);
  pointer-events: none;
  transition: opacity var(--press-out) ease-out, transform var(--press-out) ease-out;
}
.connection[data-touch-state='pressed'] .connection-avatar::after, .connection[data-touch-state='held'] .connection-avatar::after { opacity: 1; transform: scale(1); transition-duration: var(--press-in); }
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
.connection-status--invite, .connection-status--sent, .connection-status--match_invite { background: var(--cimoa-status-invite-bg); color: var(--cimoa-status-invite-ink); }
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
.connection-chevron { flex: none; width: 34.351rpx; height: 34.351rpx; transition: transform var(--press-out) ease-out; }
.connection[data-touch-state='pressed'] .connection-chevron, .connection[data-touch-state='held'] .connection-chevron { transform: translateX(7.634rpx); transition-duration: var(--press-in); }
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
.home-loading-mark { width: 61.069rpx; height: 61.069rpx; margin: 0 auto; }
.empty-title { display: block; font-size: 38.168rpx; font-weight: 700; }
.empty-copy { display: block; margin-top: 19.084rpx; font-size: 31.489rpx; line-height: 1.5; color: var(--cimoa-text-secondary); }
.empty-actions { margin-top: 41.985rpx; }
.home-list-actions { margin-top: 41.985rpx; }
.home-primary, .home-secondary { display: flex; align-items: center; justify-content: center; }
.home-primary {
  position: relative;
  overflow: hidden;
  min-height: 118.321rpx;
  border-radius: 59.16rpx;
  gap: 26.718rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-primary);
  font-size: 40.076rpx;
  font-weight: 700;
  letter-spacing: -.01em;
  isolation: isolate;
  cursor: pointer;
  transition: transform var(--press-out) ease-out, box-shadow var(--press-out) ease-out;
}
.home-primary::after {
  content: '';
  position: absolute;
  inset: -30% auto -30% -72%;
  width: 58%;
  z-index: -1;
  background: var(--cimoa-gradient-main-action-shine);
  opacity: 0;
  transform: skewX(-14deg);
  pointer-events: none;
}
.home-primary[data-touch-state='pressed'], .home-primary[data-touch-state='held'] { transform: scale(.985); box-shadow: var(--cimoa-shadow-main-action-active); transition-duration: var(--press-in); }
.home-primary[data-touch-state='pressed']::after, .home-primary[data-touch-state='held']::after { animation: home-action-sheen calc(var(--press-out) * 2) ease-out both; }
.empty-flash { width: 38.168rpx; height: 49.618rpx; }
.home-secondary {
  min-height: 106.87rpx;
  margin-top: 22.901rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-explore);
  font-size: 34.351rpx;
  font-weight: 600;
  cursor: pointer;
  transition: transform var(--press-out) ease-out, box-shadow var(--press-out) ease-out;
}
.home-secondary[data-touch-state='pressed'], .home-secondary[data-touch-state='held'] { transform: scale(.985); box-shadow: var(--cimoa-shadow-main-control-active); transition-duration: var(--press-in); }
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
  cursor: pointer;
  transition: transform var(--press-out) ease-out, box-shadow var(--press-out) ease-out;
}
.match-status[data-touch-state='pressed'], .match-status[data-touch-state='held'] { transform: scale(.985); box-shadow: var(--cimoa-shadow-event-card-active); transition-duration: var(--press-in); }
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
.match-status-action { flex: none; font-size: 28.626rpx; font-weight: 700; color: var(--cimoa-text-link); }
@keyframes home-action-sheen { from { opacity: 0; transform: translateX(0) skewX(-14deg); } 24% { opacity: 1; } to { opacity: 0; transform: translateX(310%) skewX(-14deg); } }
@media (prefers-reduced-motion: reduce) {
  .home-profile, .home-match, .profile-icon, .flash-icon, .connection-avatar::after, .connection-chevron, .home-primary, .home-secondary, .match-status { transition: none; }
  .home-profile[data-touch-state], .home-match[data-touch-state], .home-primary[data-touch-state], .home-secondary[data-touch-state], .match-status[data-touch-state] { transform: none; }
  .home-profile[data-touch-state] .profile-icon, .home-match[data-touch-state] .flash-icon, .connection[data-touch-state] .connection-chevron { transform: none; }
  .home-primary[data-touch-state]::after { animation: none; }
}
</style>
