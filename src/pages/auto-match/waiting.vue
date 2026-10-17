<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import AutoMatchFoundLeaveConfirmDialog from '@/components/AutoMatchFoundLeaveConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,guard,action,motion_style}=use_auto_match_page('waiting')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-waiting" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1769" class="am-1769-1"><view data-source-line="1770" class="am-1770-2" data-interaction="amWaiting.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1771" class="am-1771-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1771" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1773" class="am-1773-5"></view><view data-source-line="1773" class="am-1773-6">Request sent</view></view><text v-if="error" class="am-error" role="alert">{{ error }}</text></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amWaiting.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1775" class="am-1775-7"><view data-source-line="1776" class="am-1776-8"><UserAvatar data-source-line="1777" :src="c.me_img" :name="c.me.user_name" class="am-1777-9" /><UserAvatar data-source-line="1778" :src="c.candidate_avatar" :name="c.person_name" class="am-1778-10" /></view><view data-source-line="1780" class="am-1780-11">{{ c.waiting_title }}</view><view data-source-line="1781" class="am-1781-12">{{ c.waiting_copy }}</view><view data-source-line="1782" class="am-1782-13"><svg data-source-line="1783" class="am-1783-14" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-connection-status)" stroke-width="2" stroke-linecap="round"><circle data-source-line="1783" cx="12" cy="12" r="9"></circle><path data-source-line="1783" d="M12 7.5V12l3 2"></path></svg><view data-source-line="1784" class="am-1784-17">Chat unlocks when you both accept</view></view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1787" class="am-footer am-1787-18"><view data-source-line="1788" class="am-1788-19" data-interaction="amWaiting.returnHome.click.1" @click="action('returnHome',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('returnHome',$event)"><view data-source-line="1788" class="am-1788-20">Return Home</view></view><view data-source-line="1789" class="am-1789-21" data-interaction="amWaiting.cancelRequest.click.1" @click="action('cancelRequest',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('cancelRequest',$event)">Cancel Request</view></view></template></template>
<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><AutoMatchFoundLeaveConfirmDialog :open="modal === 'cancel'" :context="c" :busy="busy" cancel @action="action" /><EventActionLoading :visible="is_loading" label="Updating your match…" /></template>
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
.am-1769-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 22.901rpx;
}
.am-1770-2 {
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
.am-1771-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1773-5 { flex: 1; }
.am-1773-6 {
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
.am-1775-7 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30.535rpx;
  margin-top: 103.054rpx;
  padding: 0 38.168rpx 45.802rpx;
}
.am-1776-8 { display: flex; align-items: center; justify-content: center; }
.am-1777-9 {
  width: 175.573rpx;
  height: 175.573rpx;
  border-radius: 87.787rpx;
  object-fit: cover;
  border: 4px solid var(--cimoa-surface-card);
  display: block;
  box-shadow: var(--cimoa-shadow-auto-match-58);
}
.am-1778-10 {
  width: 175.573rpx;
  height: 175.573rpx;
  border-radius: 87.787rpx;
  object-fit: cover;
  border: 4px solid var(--cimoa-surface-card);
  margin-left: -45.801rpx;
  display: block;
  box-shadow: var(--cimoa-shadow-auto-match-58);
}
.am-1780-11 { font-size: 55.343rpx; font-weight: 800; letter-spacing: -0.035em; text-align: center; }
.am-1781-12 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); text-align: center; max-width: 572.52rpx; text-wrap: pretty; }
.am-1782-13 {
  display: flex;
  align-items: center;
  gap: 17.176rpx;
  height: 83.97rpx;
  padding: 0 34.352rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-connection-waiting);
}
.am-1783-14 { width: 34.352rpx; flex: none; height: 34.352rpx; flex: none; }
.am-1784-17 { font-size: 30.534rpx; font-weight: 600; color: var(--cimoa-text-connection-status); }
.am-1787-18 {
  display: flex;
  flex-direction: column;
  gap: 11.451rpx;
  z-index: 20;
  padding: 0 38.168rpx 57.252rpx;
  flex: none;
}
.am-1788-19 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1788-20 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-1789-21 {
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
