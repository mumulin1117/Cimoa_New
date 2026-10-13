<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { replace_route } from '@/utils/routeTransition.js'
import TopSafeArea from '@/components/TopSafeArea.vue'

const state = ref('empty')
const content = { loading: ['Loading your Cimoa space', 'A moment while we prepare your next hello.'], offline: ['You are offline', 'Reconnect to continue exploring nearby people and events.'], error: ['Something went wrong', 'Try again in a moment.'], maintenance: ['Cimoa is taking a short pause', 'We will be back soon.'], empty: ['Nothing here yet', 'When you connect, this space will fill with thoughtful things.'], permission: ['Permission needed', 'Allow access in Settings to continue.'], session: ['Session expired', 'Please sign in again to continue.'] }
onLoad((options) => { if (options?.state) state.value = options.state })
</script>

<template><view class="cimoa-page system-page"><TopSafeArea /><view class="system-card"><image class="system-card__image" src="/static/assets/icons/ic-connect.png" mode="aspectFit" /><text class="system-card__title">{{ content[state]?.[0] }}</text><text class="system-card__copy">{{ content[state]?.[1] }}</text><view class="cimoa-button" role="button" @click="replace_route(state === 'session' ? '/pages/auth/index?view=login' : '/pages/home/index')">{{ state === 'session' ? 'Log in again' : state === 'empty' ? 'Explore Discover' : 'Try again' }}</view></view></view></template>

<style scoped>.system-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 40rpx; }.system-card { width: 100%; max-width: 620rpx; padding: 50rpx 32rpx; border-radius: 32rpx; background: var(--cimoa-card); text-align: center; }.system-card__image { width: 100rpx; height: 100rpx; padding: 20rpx; border-radius: 28rpx; background: var(--cimoa-primary); }.system-card__title, .system-card__copy { display: block; }.system-card__title { margin-top: 28rpx; color: var(--cimoa-title); font-size: 32rpx; font-weight: 700; }.system-card__copy { margin: 12rpx auto 28rpx; color: var(--cimoa-secondary); font-size: 22rpx; line-height: 34rpx; }</style>
