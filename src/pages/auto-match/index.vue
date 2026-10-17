<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,guard,action}=use_auto_match_page('index')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-index" :scroll-locked="!!modal">
<template #header><view data-source-line="1462" class="am-1462-1"><view data-source-line="1463" class="am-1463-2" data-interaction="amEntry.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1464" class="am-1464-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-surface-deep)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1464" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1466" class="am-1466-5"></view><view data-source-line="1466" class="am-1466-6">Auto Match</view></view><text v-if="error" class="am-error" role="alert">{{ error }}</text></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" @click="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1468" class="am-1468-7"><view data-source-line="1469" class="am-1469-8">Meet someone new</view><view data-source-line="1470" class="am-1470-9">Join the pool and we’ll introduce you to a compatible student who’s also available.</view><view data-source-line="1471" class="am-1471-10"><svg data-source-line="1472" class="am-1472-11" viewBox="0 0 24 24" fill="none"><circle data-source-line="1472" cx="12" cy="12" r="11" fill="var(--cimoa-status-verified)"></circle><path data-source-line="1472" d="m7.5 12.4 3 3 6-6.4" stroke="var(--cimoa-surface-card)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><view data-source-line="1473" class="am-1473-14">Verified students only</view></view><view data-source-line="1475" class="am-1475-15"><view data-source-line="1476" class="am-1476-16"><view data-source-line="1477" class="am-1477-17">1</view><view data-source-line="1478" class="am-1478-18">Join the pool</view></view><view data-source-line="1480" class="am-1480-19"><view data-source-line="1481" class="am-1481-20">2</view><view data-source-line="1482" class="am-1482-21">Get matched</view></view><view data-source-line="1484" class="am-1484-22"><view data-source-line="1485" class="am-1485-23">3</view><view data-source-line="1486" class="am-1486-24">Both choose to connect</view></view></view><view data-source-line="1489" class="am-1489-25"><view data-source-line="1490" class="am-1490-26"><view data-source-line="1491" class="am-1491-27"><svg data-source-line="1491" class="am-1491-28" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-link)" stroke-width="2" stroke-linecap="round"><circle data-source-line="1491" cx="12" cy="12" r="9"></circle><path data-source-line="1491" d="M12 7.5V12l3 2"></path></svg></view><view data-source-line="1492" class="am-1492-31"><view data-source-line="1492" class="am-1492-32">Estimated wait</view><view data-source-line="1492" class="am-1492-33">{{ c.entry_wait }}</view></view></view><view data-source-line="1494" class="am-1494-34"><view data-source-line="1495" class="am-1495-35"><svg data-source-line="1495" class="am-1495-36" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-brand-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1495" cx="9" cy="8" r="3.4"></circle><path data-source-line="1495" d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 20a5.6 5.6 0 0 0-2.2-4.4"></path></svg></view><view data-source-line="1496" class="am-1496-39"><view data-source-line="1496" class="am-1496-40">Available now</view><view data-source-line="1496" class="am-1496-41">{{ c.available_now }}</view></view></view></view><view data-source-line="1499" class="am-1499-42"><view data-source-line="1500" class="am-1500-43">{{ c.am_cost_note }} You can pause or leave at any time. A match doesn’t unlock chat — you both have to accept first.</view></view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1503" class="am-footer am-1503-44"><view data-source-line="1504" class="am-1504-45" data-interaction="amEntry.joinPool.click.1" @click="action('joinPool',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('joinPool',$event)"><view data-source-line="1504" class="am-1504-46"><view data-source-line="1504" class="am-1504-47">{{ c.join_pool_label }}</view><view data-source-line="1504" class="am-1504-48">{{ c.join_pool_tag }}</view></view></view><view data-source-line="1505" class="am-1505-49" data-interaction="amEntry.openPrefs.click.1" @click="action('openPrefs',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openPrefs',$event)">Match Preferences</view></view></template></template>
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
.am-1462-1 {
  height: 91.603rpx;
  display: flex;
  align-items: center;
  gap: 22.9rpx;
  z-index: 20;
  position: relative;
  margin: 7.633rpx 38.167rpx 22.9rpx;
}
.am-1463-2 {
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
.am-1464-3 { width: 41.984rpx; flex: none; height: 41.984rpx; flex: none; }
.am-1466-5 { flex: 1; }
.am-1466-6 {
  position: absolute;
  left: 110.687rpx;
  right: 110.687rpx;
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
.am-1468-7 { padding: 0 38.167rpx 45.801rpx; box-sizing: border-box; }
.am-1469-8 { font-size: 64.885rpx; font-weight: 800; letter-spacing: -0.035em; line-height: 1.08; margin-top: 11.45rpx; }
.am-1470-9 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); margin-top: 19.083rpx; line-height: 1.45; text-wrap: pretty; }
.am-1471-10 {
  display: flex;
  align-items: center;
  gap: 15.267rpx;
  margin-top: 30.534rpx;
  height: 76.335rpx;
  padding: 0 26.717rpx;
  border-radius: 38.167rpx;
  background: var(--cimoa-surface-verification-pill);
  width: fit-content;
}
.am-1472-11 { width: 32.442rpx; flex: none; height: 32.442rpx; flex: none; }
.am-1473-14 { font-size: 27.671rpx; font-weight: 600; color: var(--cimoa-text-verification-pill); }
.am-1475-15 {
  display: flex;
  flex-direction: column;
  gap: 26.717rpx;
  margin-top: 45.801rpx;
  padding: 38.167rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.801rpx;
  box-shadow: var(--cimoa-shadow-card);
}
.am-1476-16 { display: flex; align-items: center; gap: 26.717rpx; }
.am-1477-17 {
  width: 64.885rpx;
  height: 64.885rpx;
  border-radius: 32.442rpx;
  background: var(--cimoa-surface-verification-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-size: 30.534rpx;
  font-weight: 800;
  color: var(--cimoa-auto-match-match-step);
}
.am-1478-18 { font-size: 32.442rpx; font-weight: 600; }
.am-1480-19 { display: flex; align-items: center; gap: 26.717rpx; }
.am-1481-20 {
  width: 64.885rpx;
  height: 64.885rpx;
  border-radius: 32.442rpx;
  background: var(--cimoa-surface-verification-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-size: 30.534rpx;
  font-weight: 800;
  color: var(--cimoa-auto-match-match-step);
}
.am-1482-21 { font-size: 32.442rpx; font-weight: 600; }
.am-1484-22 { display: flex; align-items: center; gap: 26.717rpx; }
.am-1485-23 {
  width: 64.885rpx;
  height: 64.885rpx;
  border-radius: 32.442rpx;
  background: var(--cimoa-surface-verification-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  font-size: 30.534rpx;
  font-weight: 800;
  color: var(--cimoa-auto-match-match-step);
}
.am-1486-24 { font-size: 32.442rpx; font-weight: 600; }
.am-1489-25 { display: flex; flex-direction: column; gap: 22.9rpx; margin-top: 30.534rpx; }
.am-1490-26 {
  display: flex;
  align-items: center;
  gap: 22.9rpx;
  padding: 26.717rpx 30.534rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.801rpx;
  box-shadow: var(--cimoa-shadow-card);
}
.am-1491-27 {
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-surface-settings-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.am-1491-28 { width: 49.618rpx; flex: none; height: 49.618rpx; flex: none; }
.am-1492-31 { flex: 1; min-width: 0; }
.am-1492-32 { font-size: 27.671rpx; color: var(--cimoa-text-secondary); }
.am-1492-33 { font-size: 34.351rpx; font-weight: 700; letter-spacing: -0.02em; margin-top: 1.908rpx; }
.am-1494-34 {
  display: flex;
  align-items: center;
  gap: 22.9rpx;
  padding: 26.717rpx 30.534rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.801rpx;
  box-shadow: var(--cimoa-shadow-card);
}
.am-1495-35 {
  width: 87.786rpx;
  height: 87.786rpx;
  border-radius: 43.893rpx;
  background: var(--cimoa-auto-match-match-tone-1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.am-1495-36 { width: 49.618rpx; flex: none; height: 49.618rpx; flex: none; }
.am-1496-39 { flex: 1; min-width: 0; }
.am-1496-40 { font-size: 27.671rpx; color: var(--cimoa-text-secondary); }
.am-1496-41 { font-size: 34.351rpx; font-weight: 700; letter-spacing: -0.02em; margin-top: 1.908rpx; }
.am-1499-42 { margin-top: 34.351rpx; padding: 34.351rpx; border-radius: 41.984rpx; background: var(--cimoa-auto-match-match-note); }
.am-1500-43 { font-size: 29.58rpx; color: var(--cimoa-text-connection-status); line-height: 1.5; text-wrap: pretty; }
.am-1503-44 {
  display: flex;
  flex-direction: column;
  gap: 11.45rpx;
  z-index: 20;
  padding: 0 38.167rpx 57.251rpx;
  flex: none;
}
.am-1504-45 {
  height: 114.503rpx;
  border-radius: 57.251rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1504-46 { display: flex; align-items: center; gap: 15.267rpx; }
.am-1504-47 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-surface-card); }
.am-1504-48 {
  font-size: 28.625rpx;
  font-weight: 700;
  color: var(--cimoa-surface-card);
  padding: 7.633rpx 19.083rpx;
  border-radius: 22.9rpx;
  background: var(--cimoa-auto-match-match-cost-tag);
}
.am-1505-49 {
  height: 87.786rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 30.534rpx;
  font-weight: 600;
  color: var(--cimoa-text-connection-audio);
}
@keyframes cPulse {
  0%,100% { transform: scale(0.94); opacity: 0.16; }
  50% { transform: scale(1.04); opacity: 0.3; }
}
</style>
