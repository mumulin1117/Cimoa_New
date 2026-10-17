<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,guard,action,motion_style}=use_auto_match_page('no-match')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-no-match" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1868" class="am-1868-1"><view data-source-line="1869" class="am-1869-2" data-interaction="amNoMatch.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1870" class="am-1870-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1870" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1872" class="am-1872-5"></view><view data-source-line="1872" class="am-1872-6">Auto Match</view></view><text v-if="error" class="am-error" role="alert">{{ error }}</text></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amNoMatch.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1874" class="am-1874-7"><view data-source-line="1875" class="am-1875-8"><svg data-source-line="1876" class="am-1876-9" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-link)" stroke-width="2" stroke-linecap="round"><circle data-source-line="1876" cx="11" cy="11" r="7"></circle><path data-source-line="1876" d="M16.2 16.2 21 21"></path></svg></view><view data-source-line="1878" class="am-1878-12">No compatible matches are available right now</view><view data-source-line="1879" class="am-1879-13">You can stay in the pool, adjust your preferences, or try again later.</view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1881" class="am-footer am-1881-14"><view data-source-line="1882" class="am-1882-15" data-interaction="amNoMatch.findAnother.click.1" @click="action('findAnother',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('findAnother',$event)"><view data-source-line="1882" class="am-1882-16">Stay in Pool</view></view><view data-source-line="1883" class="am-1883-17" data-interaction="amNoMatch.adjustPrefs.click.1" @click="action('adjustPrefs',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('adjustPrefs',$event)"><view data-source-line="1883" class="am-1883-18">Adjust Preferences</view></view><view data-source-line="1884" class="am-1884-19" data-interaction="amNoMatch.returnHome.click.1" @click="action('returnHome',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('returnHome',$event)">Return Home</view></view></template></template>
<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><EventActionLoading :visible="is_loading" label="Updating your match…" /></template>
</SecondaryPageFrame>
</template>
<style scoped>
.auto-match-page { -webkit-font-smoothing: antialiased; line-height: normal; }
.am-error {
  display: block;
  padding: 15.267rpx 38.167rpx;
  font-size: 28.625rpx;
  line-height: 1.4;
  color: var(--cimoa-status-danger);
  overflow-wrap: anywhere;
}
.am-footer { position: relative; }
.am-shared { display: flex; flex-wrap: wrap; gap: 19.083rpx; margin-top: 26.717rpx; }
.am-interest {
  display: flex;
  align-items: center;
  gap: 15.267rpx;
  height: 83.969rpx;
  padding: 0 30.534rpx;
  border-radius: 41.984rpx;
  font-size: 30.534rpx;
  font-weight: 700;
}
.am-emoji { font-size: 36.259rpx; line-height: 1; flex: none; }
.am-1868-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 22.901rpx;
}
.am-1869-2 {
  width: 87.787rpx;
  height: 87.787rpx;
  border-radius: 43.894rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
.am-1870-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1872-5 { flex: 1; }
.am-1872-6 {
  position: absolute;
  left: 110.688rpx;
  right: 110.688rpx;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.15;
  pointer-events: none;
  font-size: 40.076rpx;
  font-weight: 700;
  letter-spacing: -0.025em;
}
.am-1874-7 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30.535rpx;
  margin-top: 114.504rpx;
  padding: 0 38.168rpx 45.802rpx;
}
.am-1875-8 {
  width: 183.207rpx;
  height: 183.207rpx;
  border-radius: 91.604rpx;
  background: var(--cimoa-surface-verification-pill);
  display: flex;
  align-items: center;
  justify-content: center;
}
.am-1876-9 { width: 76.336rpx; flex: none; height: 76.336rpx; flex: none; }
.am-1878-12 { font-size: 49.618rpx; font-weight: 800; letter-spacing: -0.035em; text-align: center; text-wrap: pretty; }
.am-1879-13 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); text-align: center; max-width: 572.52rpx; text-wrap: pretty; }
.am-1881-14 {
  display: flex;
  flex-direction: column;
  gap: 19.084rpx;
  z-index: 20;
  padding: 0 38.168rpx 57.252rpx;
  flex: none;
}
.am-1882-15 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1882-16 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-1883-17 {
  height: 106.871rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-connection-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.am-1883-18 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-title); }
.am-1884-19 {
  height: 87.787rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 30.534rpx;
  font-weight: 600;
  color: var(--cimoa-text-connection-audio);
}
@keyframes cRise {
  from { opacity: 0; transform: translateY(26.718rpx); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cPulse {
  0%,100% { transform: scale(0.94); opacity: 0.16; }
  50% { transform: scale(1.04); opacity: 0.3; }
}
</style>
