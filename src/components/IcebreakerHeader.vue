<script setup>
import SourceIcon from './SourceIcon.vue'
defineProps({ title: String, interaction: String, busy: Boolean, variant: String, menu: Boolean })
defineEmits(['back', 'menu'])
</script>
<template>
  <view class="ice-header" :class="{ 'ice-header--voice': variant === 'voice', 'ice-header--text': variant === 'text' }">
    <view class="ice-back" role="button" tabindex="0" aria-label="Back" :aria-disabled="busy" :data-interaction="interaction" @click="!busy && $emit('back')" @keydown.enter="!busy && $emit('back')"><view><SourceIcon name="back" /></view></view>
    <text class="ice-header-title">{{ title }}</text>
    <view v-if="menu" class="ice-back ice-menu" role="button" tabindex="0" aria-label="Voice options" :aria-disabled="busy" data-interaction="ibVoice.openVoiceMenu.click.1" @click="!busy && $emit('menu')" @keydown.enter="!busy && $emit('menu')"><view><SourceIcon name="more" /></view></view>
  </view>
</template>
<style scoped>
.ice-header { position: relative; display: flex; align-items: center; height: 91.603rpx; margin: 7.634rpx 38.168rpx 26.718rpx; }
.ice-back { flex: none; display: flex; align-items: center; justify-content: center; width: 87.786rpx; height: 87.786rpx; border-radius: 43.893rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); color: var(--cimoa-text-title); cursor: pointer; }
.ice-back > view { width: 41.985rpx; height: 41.985rpx; }
.ice-header-title { position: absolute; inset: 0 110.687rpx; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.15; pointer-events: none; font-size: 40.076rpx; font-weight: 700; letter-spacing: -0.025em; }
.ice-header--voice { height: 87.786rpx; }
.ice-header--voice .ice-header-title { font-weight: 800; letter-spacing: -0.02em; }
.ice-header--text { height: 87.786rpx; margin-bottom: 30.534rpx; }
.ice-header--text .ice-header-title { font-size: 41.985rpx; }
.ice-menu { margin-left: auto; }
.ice-menu > view { width: 38.168rpx; height: 38.168rpx; }
</style>
