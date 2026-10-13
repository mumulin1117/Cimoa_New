<script setup>
import { computed } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { push_route } from '@/utils/routeTransition.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import CustomTabBar from '@/components/CustomTabBar.vue'

const store = use_app_store()
const greeting = computed(() => `Good morning, ${store.current_user.user_name}`)
const people = computed(() => store.visible_people.slice(0, 3))
const upcoming = computed(() => store.events.filter((event) => event.joined))
const open_discover = () => push_route('/pages/discover/index')
const open_events = () => push_route('/pages/events/index')
const open_profile = () => push_route('/pages/profile/index')
const open_person = (user_id) => push_route(`/pages/discover/index?view=profile&user_id=${user_id}`)
const open_event = (event_id) => push_route(`/pages/events/index?view=detail&event_id=${event_id}`)
const open_match = () => push_route('/pages/auto-match/index')
const save_event = (event_id) => store.toggle_event_saved(event_id)
</script>

<template>
  <view class="cimoa-page home-page">
    <TopSafeArea />
    <scroll-view class="cimoa-scroll" scroll-y :show-scrollbar="false">
      <view class="cimoa-header"><view><text class="cimoa-eyebrow">Cimoa · Campus life</text><text class="cimoa-title">{{ greeting }}</text></view><view class="cimoa-avatar" role="button" aria-label="Open profile" @click="open_profile"><image :src="store.current_user.avatar_url" mode="aspectFill" /></view></view>
      <view class="hero-card"><view class="hero-card__copy"><text class="cimoa-eyebrow hero-card__eyebrow">Your week, curated</text><text class="hero-card__title">Make room for a little more life.</text><text class="hero-card__body">Find people, places, and plans that feel like you.</text><view class="cimoa-button hero-card__button" role="button" @click="open_discover">Explore nearby</view></view><image class="hero-card__image" src="/static/assets/head/maya-full.png" mode="aspectFill" /></view>
      <view class="section-head"><view><text class="cimoa-eyebrow">For you</text><text class="cimoa-section-title">People worth meeting</text></view><text class="section-link" role="button" @click="open_discover">See all</text></view>
      <view class="people-list"><view v-for="person in people" :key="person.user_id" class="person-card cimoa-card" role="button" @click="open_person(person.user_id)"><view class="person-card__avatar cimoa-avatar"><image :src="person.avatar_url" mode="aspectFill" /></view><text class="person-card__name">{{ person.user_name }}</text><text class="person-card__detail">{{ person.major }} · {{ person.distance }}</text><view class="person-card__action">View profile <text class="person-card__plus">+</text></view></view></view>
      <view class="section-head events-head"><view><text class="cimoa-eyebrow">On your radar</text><text class="cimoa-section-title">Upcoming events</text></view><text class="section-link" role="button" @click="open_events">Browse</text></view>
      <view v-for="event in upcoming" :key="event.event_id" class="event-card cimoa-card" role="button" @click="open_event(event.event_id)"><image class="event-card__image" :src="event.image_url" mode="aspectFill" /><view class="event-card__info"><text class="event-card__title">{{ event.title }}</text><text class="event-card__meta">{{ event.date_label }} · {{ event.location }}</text></view><view class="event-card__save" :class="{ saved: event.saved }" role="button" aria-label="Save event" @click.stop="save_event(event.event_id)">{{ event.saved ? 'Saved' : 'Save' }}</view></view>
      <view class="quote-card"><text class="quote-card__copy">The best plans are the ones you almost did not make.</text><text class="quote-card__byline">A little nudge from Cimoa</text></view>
      <view class="match-link cimoa-card" role="button" @click="open_match"><view><text class="cimoa-eyebrow">Auto match</text><text class="match-link__title">Try one intentional connection.</text></view><text class="match-link__action">Open</text></view>
    </scroll-view>
    <CustomTabBar active="home" />
  </view>
</template>

<style scoped>
.home-page { padding-bottom: 148rpx; }.hero-card { position: relative; min-height: 360rpx; overflow: hidden; margin-bottom: 46rpx; padding: 34rpx; border-radius: 32rpx; background: var(--cimoa-deep); color: var(--cimoa-card); }.hero-card__copy { position: relative; z-index: 1; width: 62%; }.hero-card__eyebrow { color: var(--cimoa-primary); }.hero-card__title { display: block; margin: 20rpx 0 12rpx; font-size: 42rpx; font-weight: 700; line-height: 52rpx; }.hero-card__body { display: block; color: var(--cimoa-tertiary); font-size: 23rpx; line-height: 34rpx; }.hero-card__button { width: 250rpx; min-height: 70rpx; margin-top: 26rpx; font-size: 22rpx; }.hero-card__image { position: absolute; right: -34rpx; bottom: -10rpx; width: 310rpx; height: 390rpx; opacity: .75; }.section-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22rpx; }.section-link { padding-bottom: 6rpx; color: var(--cimoa-secondary); font-size: 22rpx; }.people-list { display: flex; gap: 16rpx; overflow: hidden; }.person-card { flex: 1; min-width: 0; padding: 20rpx; }.person-card__avatar { width: 86rpx; height: 86rpx; margin-bottom: 16rpx; }.person-card__name { display: block; overflow: hidden; color: var(--cimoa-title); font-size: 24rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.person-card__detail { display: block; margin-top: 6rpx; overflow: hidden; color: var(--cimoa-secondary); font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }.person-card__action { display: flex; justify-content: space-between; margin-top: 20rpx; color: var(--cimoa-success); font-size: 19rpx; font-weight: 700; }.person-card__plus { color: var(--cimoa-title); font-size: 26rpx; }.events-head { margin-top: 46rpx; }.event-card { display: flex; align-items: center; margin-bottom: 14rpx; padding: 18rpx; }.event-card__image { width: 82rpx; height: 82rpx; border-radius: 18rpx; }.event-card__info { flex: 1; min-width: 0; margin-left: 18rpx; }.event-card__title { display: block; overflow: hidden; color: var(--cimoa-title); font-size: 24rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.event-card__meta { display: block; margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 18rpx; }.event-card__save { padding: 12rpx 4rpx 12rpx 12rpx; color: var(--cimoa-secondary); font-size: 18rpx; }.event-card__save.saved { color: var(--cimoa-success); }.quote-card { margin-top: 34rpx; padding: 30rpx; border-radius: 26rpx; background: var(--cimoa-tinted); }.quote-card__copy { display: block; color: var(--cimoa-title); font-size: 27rpx; font-weight: 650; line-height: 38rpx; }.quote-card__byline { display: block; margin-top: 16rpx; color: var(--cimoa-secondary); font-size: 18rpx; }
.match-link { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; padding: 22rpx; }.match-link__title { display: block; margin-top: 8rpx; color: var(--cimoa-title); font-size: 23rpx; font-weight: 700; }.match-link__action { color: var(--cimoa-success); font-size: 19rpx; font-weight: 700; }
</style>
