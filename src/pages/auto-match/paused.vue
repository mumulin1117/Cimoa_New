<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import AutoMatchLeavingConfirmDialog from '@/components/AutoMatchLeavingConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,guard,action,motion_style}=use_auto_match_page('paused')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-paused" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1672" class="am-1672-1"><view data-source-line="1673" class="am-1673-2" data-interaction="amPaused.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1674" class="am-1674-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1674" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1676" class="am-1676-5"></view><view data-source-line="1676" class="am-1676-6">Matching paused</view></view><text v-if="error" class="am-error" role="alert">{{ error }}</text></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amPaused.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1678" class="am-1678-7"><view data-source-line="1679" class="am-1679-8"><view data-source-line="1680" class="am-1680-9"><svg data-source-line="1681" class="am-1681-10" viewBox="0 0 24 24" fill="var(--cimoa-text-connection-audio)"><rect data-source-line="1681" x="6" y="4" width="4.6" height="16" rx="1.8"></rect><rect data-source-line="1681" x="13.4" y="4" width="4.6" height="16" rx="1.8"></rect></svg></view><view data-source-line="1683" class="am-1683-13">You’re not in the pool right now</view><view data-source-line="1684" class="am-1684-14">Other students can’t see you as available. Your preferences and queue place are saved.</view></view><view data-source-line="1686" class="am-1686-15"><view data-source-line="1687" class="am-1687-16"><svg data-source-line="1688" class="am-1688-17" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-brand-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1688" cx="9" cy="8" r="3.4"></circle><path data-source-line="1688" d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 20a5.6 5.6 0 0 0-2.2-4.4"></path></svg><view data-source-line="1689" class="am-1689-20"><view data-source-line="1689" class="am-1689-21">Saved queue position</view><view data-source-line="1689" class="am-1689-22">{{ c.queue_pos }}</view></view></view><view data-source-line="1691" class="am-1691-23" data-interaction="amPaused.openPrefs.click.1" @click="action('openPrefs',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openPrefs',$event)"><view data-source-line="1692" class="am-1692-24"><view data-source-line="1692" class="am-1692-25">Saved preferences</view><view data-source-line="1692" class="am-1692-26">{{ c.pref_summary }}</view></view><svg data-source-line="1693" class="am-1693-27" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-profile-chevron)" stroke-width="2.4" stroke-linecap="round"><path data-source-line="1693" d="M9 5l7 7-7 7"></path></svg></view></view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1697" class="am-footer am-1697-29"><view data-source-line="1698" class="am-1698-30" data-interaction="amPaused.resumeQueue.click.1" @click="action('resumeQueue',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('resumeQueue',$event)"><view data-source-line="1698" class="am-1698-31">Resume Matching</view></view><view data-source-line="1699" class="am-1699-32" data-interaction="amPaused.askLeave.click.1" @click="action('askLeave',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('askLeave',$event)">Leave Pool</view></view></template></template>
<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><AutoMatchLeavingConfirmDialog :open="modal === 'leaving'" :context="c" :busy="busy" @action="action" /><EventActionLoading :visible="is_loading" label="Updating your match…" /></template>
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
.am-1672-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 26.718rpx;
}
.am-1673-2 {
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
.am-1674-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1676-5 { flex: 1; }
.am-1676-6 {
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
.am-1678-7 { padding: 0 38.168rpx 45.802rpx; box-sizing: border-box; }
.am-1679-8 { display: flex; flex-direction: column; align-items: center; gap: 34.352rpx; margin-top: 49.619rpx; }
.am-1680-9 {
  width: 229.008rpx;
  height: 229.008rpx;
  border-radius: 114.504rpx;
  background: var(--cimoa-surface-connection-waiting);
  display: flex;
  align-items: center;
  justify-content: center;
}
.am-1681-10 { width: 83.97rpx; flex: none; height: 83.97rpx; flex: none; }
.am-1683-13 { font-size: 49.618rpx; font-weight: 800; letter-spacing: -0.03em; text-align: center; }
.am-1684-14 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); text-align: center; text-wrap: pretty; }
.am-1686-15 { display: flex; flex-direction: column; gap: 22.901rpx; margin-top: 45.802rpx; }
.am-1687-16 {
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  padding: 26.718rpx 30.535rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
}
.am-1688-17 { flex: none; width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1689-20 { flex: 1; min-width: 0; }
.am-1689-21 { font-size: 27.671rpx; color: var(--cimoa-text-secondary); }
.am-1689-22 { font-size: 34.351rpx; font-weight: 700; letter-spacing: -0.02em; margin-top: 1.909rpx; }
.am-1691-23 {
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  padding: 26.718rpx 30.535rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
  cursor: pointer;
}
.am-1692-24 { flex: 1; min-width: 0; }
.am-1692-25 { font-size: 27.671rpx; color: var(--cimoa-text-secondary); }
.am-1692-26 { font-size: 34.351rpx; font-weight: 700; letter-spacing: -0.02em; margin-top: 1.909rpx; }
.am-1693-27 { flex: none; width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1697-29 {
  display: flex;
  flex-direction: column;
  gap: 11.451rpx;
  z-index: 20;
  padding: 0 38.168rpx 57.252rpx;
  flex: none;
}
.am-1698-30 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1698-31 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-1699-32 {
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
