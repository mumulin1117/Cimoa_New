<script setup>
import SourceIcon from './SourceIcon.vue'
defineProps({ profileTarget: { type: String, default: '' }, preferencesTarget: { type: String, default: '' } })
defineEmits(['profile', 'preferences'])
</script>

<template>
  <view class="discover-header">
    <view class="discover-toolbar">
      <view class="discover-tool discover-tool--profile" role="button" aria-label="My profile" tabindex="0" data-interaction="photo.openMe.click.1" :data-target="profileTarget" @click="$emit('profile')" @keydown.enter="$emit('profile')" @keydown.space.prevent="$emit('profile')"><view class="discover-person-icon"><SourceIcon name="person" /></view></view>
      <view class="discover-tool discover-tool--filter" role="button" aria-label="Discover preferences" tabindex="0" data-interaction="photo.openDiscoverFilters.click.1" :data-target="preferencesTarget" @click="$emit('preferences')" @keydown.enter="$emit('preferences')" @keydown.space.prevent="$emit('preferences')"><view class="discover-filter-icon"><SourceIcon name="filter" /></view></view>
    </view>
  </view>
</template>

<style scoped>
.discover-header { padding-top: calc(var(--app-safe-top) + 11.45rpx); padding-bottom: 30.534rpx; }
.discover-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0 38.168rpx; }
.discover-tool {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 103.053rpx;
  height: 103.053rpx;
  border-radius: 51.527rpx;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-icon-primary);
  cursor: pointer;
  isolation: isolate;
  transition: transform var(--discover-press-out) ease-out, box-shadow var(--discover-press-out) ease-out;
}
.discover-tool::after {
  content: '';
  position: absolute;
  inset: -17.176rpx;
  z-index: -1;
  border-radius: 50%;
  background: var(--cimoa-gradient-main-control-aura);
  opacity: 0;
  transform: scale(.72);
  pointer-events: none;
  transition: opacity var(--discover-press-out) ease-out, transform var(--discover-press-out) ease-out;
}
.discover-tool[data-touch-state='pressed'], .discover-tool[data-touch-state='held'] { transform: scale(.94); box-shadow: var(--cimoa-shadow-main-control-active); transition-duration: var(--discover-press-in); }
.discover-tool[data-touch-state='pressed']::after, .discover-tool[data-touch-state='held']::after { opacity: 1; transform: scale(1); transition-duration: var(--discover-press-in); }
.discover-tool[data-touch-state='pressed'] .discover-person-icon, .discover-tool[data-touch-state='held'] .discover-person-icon { transform: rotate(-6deg); }
.discover-tool[data-touch-state='pressed'] .discover-filter-icon, .discover-tool[data-touch-state='held'] .discover-filter-icon { transform: rotate(8deg) scale(1.05); }
.discover-tool--profile { box-shadow: var(--cimoa-shadow-discover-profile); }
.discover-tool--filter { box-shadow: var(--cimoa-shadow-discover-filter); }
.discover-person-icon { width: 49.618rpx; height: 49.618rpx; transition: transform var(--discover-press-out) ease-out; }
.discover-filter-icon { width: 45.802rpx; height: 45.802rpx; transition: transform var(--discover-press-out) ease-out; }
@media (prefers-reduced-motion: reduce) {
  .discover-tool, .discover-tool::after, .discover-person-icon, .discover-filter-icon { transition: none; }
  .discover-tool[data-touch-state], .discover-tool[data-touch-state] .discover-person-icon, .discover-tool[data-touch-state] .discover-filter-icon { transform: none; }
}
</style>
