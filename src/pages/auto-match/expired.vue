<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,guard,action,motion_style}=use_auto_match_page('expired')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-expired" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1845" class="am-1845-1"><view data-source-line="1846" class="am-1846-2" data-interaction="amExpired.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1847" class="am-1847-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-surface-deep)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1847" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1849" class="am-1849-5"></view><view data-source-line="1849" class="am-1849-6">Auto Match</view></view><text v-if="error" class="am-error" role="alert">{{ error }}</text></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" @click="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1851" class="am-1851-7"><view data-source-line="1852" class="am-1852-8"><svg data-source-line="1853" class="am-1853-9" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-connection-audio)" stroke-width="2.2" stroke-linecap="round"><circle data-source-line="1853" cx="12" cy="12" r="9"></circle><path data-source-line="1853" d="M12 7.5V12l3.5 2.2"></path></svg></view><view data-source-line="1855" class="am-1855-12">This match has expired</view><view data-source-line="1856" class="am-1856-13">The response window closed. No connection was made.</view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1858" class="am-footer am-1858-14"><view data-source-line="1859" class="am-1859-15" data-interaction="amExpired.findAnother.click.1" @click="action('findAnother',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('findAnother',$event)"><view data-source-line="1859" class="am-1859-16">Find Another Match</view></view><view data-source-line="1860" class="am-1860-17" data-interaction="amExpired.returnHome.click.1" @click="action('returnHome',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('returnHome',$event)"><view data-source-line="1860" class="am-1860-18">Return Home</view></view></view></template></template>
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
.am-1845-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 22.901rpx;
}
.am-1846-2 {
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
.am-1847-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1849-5 { flex: 1; }
.am-1849-6 {
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
.am-1851-7 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30.535rpx;
  margin-top: 137.405rpx;
  padding: 0 38.168rpx 45.802rpx;
}
.am-1852-8 {
  width: 183.207rpx;
  height: 183.207rpx;
  border-radius: 91.604rpx;
  background: var(--cimoa-surface-connection-waiting);
  display: flex;
  align-items: center;
  justify-content: center;
}
.am-1853-9 { width: 80.153rpx; flex: none; height: 80.153rpx; flex: none; }
.am-1855-12 { font-size: 55.343rpx; font-weight: 800; letter-spacing: -0.035em; text-align: center; }
.am-1856-13 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); text-align: center; max-width: 572.52rpx; text-wrap: pretty; }
.am-1858-14 {
  display: flex;
  flex-direction: column;
  gap: 22.901rpx;
  z-index: 20;
  padding: 0 38.168rpx 64.886rpx;
  flex: none;
}
.am-1859-15 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1859-16 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-surface-card); }
.am-1860-17 {
  height: 106.871rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-connection-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.am-1860-18 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-surface-deep); }
@keyframes cRise {
  from { opacity: 0; transform: translateY(26.718rpx); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cPulse {
  0%,100% { transform: scale(0.94); opacity: 0.16; }
  50% { transform: scale(1.04); opacity: 0.3; }
}
</style>
