<script setup>
import { computed } from 'vue'
import { use_app_store } from '@/stores/store.js'
import theme from '@/config/theme.json'
import TopSafeArea from '@/components/TopSafeArea.vue'
import BottomSafeArea from '@/components/BottomSafeArea.vue'
import CustomTabBar from '@/components/CustomTabBar.vue'

const app_store = use_app_store()
const avatar_colors = Object.fromEntries(Object.entries(theme.colors.avatar))
const theme_style = computed(() => ({
  '--page-background': theme.colors.page.background, '--title-color': theme.colors.text.title,
  '--secondary-color': theme.colors.text.secondary, '--tertiary-color': theme.colors.text.tertiary,
  '--accent-color': theme.colors.button.primary, '--accent-text-color': theme.colors.button.text,
  '--surface-color': theme.colors.surface.card, '--surface-deep-color': theme.colors.surface.deep,
  '--surface-border-color': theme.colors.surface.border, '--icon-color': theme.colors.icon.primary,
  '--success-color': theme.colors.status.success, '--inverse-text-color': theme.colors.surface.card,
  '--lavender-color': theme.colors.surface.accent_lavender, '--tinted-surface-color': theme.colors.surface.tinted
}))
const greeting = computed(() => `Good morning, ${app_store.current_user.user_name.split(' ')[0]}`)
const switch_tab = (tab) => { if (tab !== 'home') uni.showToast({ title: `${tab[0].toUpperCase()}${tab.slice(1)} is coming soon`, icon: 'none' }) }
const save_event = (id) => app_store.toggle_saved_event(id)
</script>

<template>
  <view class="page" :style="theme_style">
    <TopSafeArea />
    <scroll-view class="content" scroll-y :show-scrollbar="false">
      <view class="header"><view><text class="eyebrow">C I M O A  ·  CAMPUS LIFE</text><text class="greeting">{{ greeting }}</text></view><view class="avatar" role="button" aria-label="Open profile">MC</view></view>
      <view class="hero"><view class="hero__copy"><text class="hero__eyebrow">YOUR WEEK, CURATED</text><text class="hero__title">Make room for a little more life.</text><text class="hero__body">Find people, places, and plans that feel like you.</text><view class="hero__cta" role="button" @click="switch_tab('discover')">Explore nearby <text>↗</text></view></view><view class="hero__orb">✦</view></view>
      <view class="section-heading"><view><text class="eyebrow">FOR YOU</text><text class="section-title">People worth meeting</text></view><text class="see-all" role="button" @click="switch_tab('discover')">See all →</text></view>
      <scroll-view class="people-row" scroll-x :show-scrollbar="false"><view v-for="person in app_store.people" :key="person.user_id" class="person-card" role="button"><view class="person-card__avatar" :style="{ background: avatar_colors[person.avatar_tone] }">{{ person.initials }}</view><text class="person-card__name">{{ person.user_name }}</text><text class="person-card__detail">{{ person.detail }}</text><view class="person-card__action">Say hello <text>+</text></view></view></scroll-view>
      <view class="section-heading events-heading"><view><text class="eyebrow">ON YOUR RADAR</text><text class="section-title">Upcoming events</text></view><text class="see-all" role="button" @click="switch_tab('events')">Browse →</text></view>
      <view v-for="event in app_store.upcoming_events" :key="event.event_id" class="event-card" role="button"><view class="event-card__mark" :class="event.accent">✦</view><view class="event-card__info"><text class="event-card__title">{{ event.title }}</text><text class="event-card__meta">{{ event.meta }}  ·  {{ event.location }}</text></view><view class="event-card__save" :class="{ saved: event.saved }" aria-label="Save event" @click.stop="save_event(event.event_id)">{{ event.saved ? '♥' : '♡' }}</view></view>
      <view class="quote"><text class="quote__mark">“</text><text class="quote__copy">The best plans are the ones you almost didn't make.</text><text class="quote__byline">— A little nudge from Cimoa</text></view>
    </scroll-view>
    <CustomTabBar active="home" @change="switch_tab" />
    <BottomSafeArea />
  </view>
</template>

<style scoped>
.page{min-height:100vh;background:var(--page-background);color:var(--title-color);display:flex;flex-direction:column}.content{height:calc(100vh - 150rpx);padding:34rpx 36rpx 52rpx}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:40rpx}.eyebrow{display:block;color:var(--tertiary-color);font-size:18rpx;letter-spacing:3rpx;font-weight:700}.greeting{display:block;margin-top:10rpx;font-size:46rpx;line-height:60rpx;font-weight:650;letter-spacing:-1rpx}.avatar{width:78rpx;height:78rpx;border-radius:50%;background:var(--surface-deep-color);color:var(--inverse-text-color);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22rpx}.hero{min-height:318rpx;border-radius:32rpx;background:var(--surface-deep-color);padding:34rpx;position:relative;overflow:hidden;color:var(--inverse-text-color);margin-bottom:48rpx}.hero__copy{position:relative;z-index:1;max-width:520rpx}.hero__eyebrow{font-size:18rpx;letter-spacing:3rpx;color:var(--accent-color)}.hero__title{display:block;font-size:46rpx;line-height:54rpx;font-weight:650;margin:20rpx 0 14rpx;letter-spacing:-1rpx}.hero__body{display:block;color:var(--tertiary-color);font-size:24rpx;line-height:36rpx}.hero__cta{display:flex;justify-content:space-between;align-items:center;width:250rpx;margin-top:26rpx;padding:18rpx 22rpx;border-radius:100rpx;background:var(--accent-color);color:var(--accent-text-color);font-size:22rpx;font-weight:700}.hero__orb{position:absolute;right:-46rpx;bottom:-70rpx;width:300rpx;height:300rpx;border-radius:50%;background:var(--accent-color);color:var(--surface-deep-color);font-size:110rpx;display:flex;align-items:flex-start;justify-content:center;padding-top:44rpx;transform:rotate(14deg)}.section-heading{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:22rpx}.section-title{display:block;font-size:34rpx;line-height:44rpx;font-weight:650;margin-top:8rpx}.see-all{font-size:22rpx;color:var(--secondary-color);padding-bottom:6rpx}.people-row{display:flex;white-space:nowrap;margin:0 -36rpx;padding:0 36rpx 10rpx}.person-card{display:inline-flex;flex-direction:column;width:268rpx;padding:24rpx;background:var(--surface-color);border:1px solid var(--surface-border-color);border-radius:24rpx;margin-right:18rpx}.person-card__avatar{width:86rpx;height:86rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26rpx;font-weight:700;margin-bottom:20rpx}.person-card__name{font-size:26rpx;font-weight:650}.person-card__detail{font-size:19rpx;color:var(--secondary-color);margin-top:6rpx;overflow:hidden;text-overflow:ellipsis}.person-card__action{margin-top:22rpx;color:var(--success-color);font-size:20rpx;font-weight:650;display:flex;justify-content:space-between}.events-heading{margin-top:44rpx}.event-card{display:flex;align-items:center;padding:22rpx;margin-bottom:14rpx;border-radius:22rpx;background:var(--surface-color);border:1px solid var(--surface-border-color)}.event-card__mark{width:74rpx;height:74rpx;border-radius:18rpx;display:flex;align-items:center;justify-content:center;font-size:28rpx;margin-right:20rpx}.event-card__mark.lime{background:var(--accent-color)}.event-card__mark.lavender{background:var(--lavender-color)}.event-card__info{flex:1}.event-card__title{display:block;font-size:25rpx;font-weight:650}.event-card__meta{display:block;margin-top:8rpx;color:var(--secondary-color);font-size:19rpx}.event-card__save{font-size:38rpx;color:var(--tertiary-color);padding:14rpx}.event-card__save.saved{color:var(--success-color)}.quote{margin-top:36rpx;padding:30rpx;border-radius:24rpx;background:var(--tinted-surface-color)}.quote__mark{font-size:58rpx;line-height:30rpx;color:var(--success-color)}.quote__copy{display:block;font-size:27rpx;line-height:38rpx;font-weight:600;margin-top:12rpx}.quote__byline{display:block;color:var(--secondary-color);font-size:18rpx;margin-top:16rpx}.tabbar{flex-shrink:0}
</style>
