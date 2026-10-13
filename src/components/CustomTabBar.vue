<script setup>
defineProps({ active: { type: String, default: 'home' } })
const emit = defineEmits(['change'])
const tabs = [{ id: 'home', label: 'Home', icon: '⌂' }, { id: 'discover', label: 'Discover', icon: '✦' }, { id: 'events', label: 'Events', icon: '◷' }, { id: 'profile', label: 'Profile', icon: '○' }]
</script>
<template>
  <view class="tabbar">
    <view v-for="tab in tabs" :key="tab.id" class="tab" :class="{ active: active === tab.id }" role="button" :aria-label="tab.label" @click="emit('change', tab.id)">
      <text class="tab__icon">{{ tab.icon }}</text><text class="tab__label">{{ tab.label }}</text>
    </view>
  </view>
</template>
<style scoped>
.tabbar { display:flex; justify-content:space-around; padding:18rpx 18rpx calc(18rpx + env(safe-area-inset-bottom, 0px)); background:var(--surface-color); border-top:1px solid var(--surface-border-color); }
.tab { display:flex; flex-direction:column; align-items:center; gap:6rpx; min-width:112rpx; color:var(--tertiary-color); }
.tab.active { color:var(--title-color); }.tab__icon { font-size:38rpx; line-height:40rpx; }.tab__label { font-size:20rpx; }
</style>
