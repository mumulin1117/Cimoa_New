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
  display: flex;
  align-items: center;
  justify-content: center;
  width: 103.053rpx;
  height: 103.053rpx;
  border-radius: 51.527rpx;
  background: var(--cimoa-surface-card);
  color: var(--cimoa-icon-primary);
  cursor: pointer;
}
.discover-tool--profile { box-shadow: var(--cimoa-shadow-discover-profile); }
.discover-tool--filter { box-shadow: var(--cimoa-shadow-discover-filter); }
.discover-person-icon { width: 49.618rpx; height: 49.618rpx; }
.discover-filter-icon { width: 45.802rpx; height: 45.802rpx; }
</style>
