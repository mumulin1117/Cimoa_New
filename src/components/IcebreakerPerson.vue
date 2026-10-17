<script setup>
import UserAvatar from './UserAvatar.vue'
import SourceIcon from './SourceIcon.vue'
defineProps({ user: Object, question: String, variant: String, university: String })
</script>
<template><view class="ice-person" :class="{ 'ice-person--text': variant === 'text', 'ice-person--voice': variant === 'voice' }">
  <view class="ice-person-avatar"><UserAvatar :src="user.avatar_url" :name="user.user_name" /><view v-if="variant === 'text' && user.verification_status === 'verified'" class="ice-person-badge"><SourceIcon name="verified" :stroke-width="2.6" /></view></view>
  <view class="ice-person-copy"><view class="ice-person-name"><text>{{ user.user_name }}{{ user.age == null ? '' : `${variant === 'voice' ? ' · ' : ', '}${user.age}` }}</text><view v-if="variant !== 'text' && user.verification_status === 'verified'" class="ice-person-verified"><SourceIcon name="verified" :stroke-width="2.6" /></view></view>
    <text v-if="variant === 'text'" class="ice-person-question">{{ question }}</text>
    <template v-else-if="variant === 'voice'"><view class="ice-person-university"><view><SourceIcon name="university" /></view><text>{{ university || user.university }}</text></view><text class="ice-person-location">{{ user.location }}</text></template>
    <text v-else class="ice-person-subtitle">{{ [user.university, user.year].filter(Boolean).join(' · ') }}</text>
  </view>
</view></template>
<style scoped>
.ice-person { display: flex; align-items: center; gap: 26.718rpx; padding: 30.534rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.ice-person-avatar { position: relative; flex: none; width: 122.137rpx; height: 122.137rpx; border-radius: 50%; }
.ice-person-copy { flex: 1; min-width: 0; }
.ice-person-name { display: flex; align-items: center; gap: 13.359rpx; font-size: 38.168rpx; font-weight: 800; letter-spacing: -0.025em; }
.ice-person-name > text { overflow-wrap: anywhere; }
.ice-person-verified { flex: none; width: 36.26rpx; height: 36.26rpx; }
.ice-person-subtitle { display: block; margin-top: 3.817rpx; color: var(--cimoa-text-secondary); font-size: 28.626rpx; }
.ice-person--text { padding: 34.351rpx; }
.ice-person--text .ice-person-avatar { width: 106.87rpx; height: 106.87rpx; }
.ice-person--text .ice-person-name { font-size: 36.26rpx; font-weight: 700; letter-spacing: normal; }
.ice-person-question { display: block; margin-top: 5.725rpx; font-size: 43.893rpx; font-weight: 800; letter-spacing: -0.02em; text-wrap: pretty; }
.ice-person-badge { position: absolute; right: -3.817rpx; bottom: -3.817rpx; width: 38.168rpx; height: 38.168rpx; border-radius: 50%; background: var(--cimoa-surface-card); }
.ice-person--voice { align-items: flex-start; padding: 0; border-radius: 0; background: var(--cimoa-surface-transparent); box-shadow: none; }
.ice-person--voice .ice-person-copy { padding-top: 3.817rpx; }
.ice-person--voice .ice-person-name { letter-spacing: -0.02em; }
.ice-person-university { display: flex; align-items: center; gap: 11.45rpx; margin-top: 5.725rpx; color: var(--cimoa-text-secondary); font-size: 29.58rpx; }
.ice-person-university > view { width: 28.626rpx; height: 28.626rpx; }
.ice-person-location { display: block; margin-top: 1.908rpx; color: var(--cimoa-text-connection-muted); font-size: 29.58rpx; }
</style>
