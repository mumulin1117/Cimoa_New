<script setup>
import { ref } from 'vue'
import { switch_tab_route } from '@/utils/routeTransition.js'

const props = defineProps({ active: { type: String, default: 'home' } })
const busy = ref(false)
const tabs = [
  { id: 'home', label: 'Home', route: '/pages/home/index', icon: '/static/assets/head/me.png' },
  { id: 'discover', label: 'Discover', route: '/pages/discover/index', icon: '/static/assets/icons/ic-connect.png' },
  { id: 'events', label: 'Events', route: '/pages/events/index', icon: '/static/assets/img/event-picnic.png' },
  { id: 'profile', label: 'Profile', route: '/pages/profile/index', icon: '/static/assets/head/g1.png' },
]
const go_tab = async (tab) => {
  if (busy.value || tab.id === props.active) return
  busy.value = true
  try { await switch_tab_route(tab.route) } finally { busy.value = false }
}
</script>

<template>
  <view class="tabbar" role="navigation" aria-label="Primary navigation">
    <view v-for="tab in tabs" :key="tab.id" class="tab" :class="{ active: active === tab.id }" role="button" :aria-label="tab.label" @click="go_tab(tab)">
      <image class="tab__icon" :src="tab.icon" mode="aspectFill" /><text class="tab__label">{{ tab.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; justify-content: space-around; padding: 16rpx 18rpx max(env(safe-area-inset-bottom, 0px), var(--native-safe-area-bottom, 0px)); background: var(--cimoa-card); border-top: 1px solid var(--cimoa-border); }
.tab { display: flex; flex-direction: column; align-items: center; gap: 6rpx; min-width: 112rpx; color: var(--cimoa-tertiary); }.tab.active { color: var(--cimoa-title); }.tab__icon { width: 42rpx; height: 42rpx; border-radius: 50%; opacity: .42; }.tab.active .tab__icon { opacity: 1; }.tab__label { font-size: 20rpx; }
</style>
