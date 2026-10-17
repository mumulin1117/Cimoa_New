<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,guard,action,motion_style}=use_auto_match_page('history')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-history" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1892" class="am-1892-1"><view data-source-line="1893" class="am-1893-2" data-interaction="amHistory.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1894" class="am-1894-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1894" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1896" class="am-1896-5"></view><view data-source-line="1896" class="am-1896-6">Auto Match history</view></view><text v-if="error" class="am-error" role="alert">{{ error }}</text></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amHistory.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1898" class="am-1898-7"><view data-source-line="1899" class="am-1899-8">Connected matches, pending decisions, and expired matches from the last 30 days.</view><view v-if="!c.history_rows.length" class="am-history-empty" role="status">No Auto Match history in the last 30 days.</view><view data-source-line="1900" class="am-1900-9"><template v-for="h in c.history_rows" :key="h.value || h.match_id || h.item_id"><view data-source-line="1902" class="am-1902-11" data-interaction="amHistory.h.go.click.1" @click="action('history',$event,h)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('history',$event,h)"><template v-if="h.img"><UserAvatar data-source-line="1903" :src="h.img" :name="h.name" class="am-1903-13" /></template><template v-if="h.no_img"><view data-source-line="1904" class="am-1904-15"></view></template><view data-source-line="1905" class="am-1905-16"><view data-source-line="1906" class="am-1906-17">{{ h.name }}</view><view data-source-line="1907" class="am-1907-18">{{ h.meta }}</view></view><view data-source-line="1909" class="am-1909-19" :style="{'background':`${h.pill}`}"><view data-source-line="1909" class="am-1909-20" :style="{'color':`${h.pill_ink}`}">{{ h.pill_text }}</view></view></view></template></view></view></template>

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
.am-history-empty { margin-top: 34.352rpx; padding: 26.718rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); color: var(--cimoa-text-secondary); }
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
.am-1892-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 22.901rpx;
}
.am-1893-2 {
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
.am-1894-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1896-5 { flex: 1; }
.am-1896-6 {
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
.am-1898-7 { padding: 0 38.168rpx 45.802rpx; box-sizing: border-box; }
.am-1899-8 { font-size: 30.534rpx; color: var(--cimoa-text-secondary); text-wrap: pretty; }
.am-1900-9 { display: flex; flex-direction: column; gap: 22.901rpx; margin-top: 34.352rpx; }
.am-1902-11 {
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  padding: 26.718rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
  cursor: pointer;
}
.am-1903-13 {
  width: 99.237rpx;
  height: 99.237rpx;
  border-radius: 49.619rpx;
  object-fit: cover;
  flex: none;
  display: block;
}
.am-1904-15 { width: 99.237rpx; height: 99.237rpx; border-radius: 49.619rpx; background: var(--cimoa-surface-profile-icon); flex: none; }
.am-1905-16 { flex: 1; min-width: 0; }
.am-1906-17 { font-size: 34.351rpx; font-weight: 800; letter-spacing: -0.02em; white-space: normal; overflow-wrap: anywhere; }
.am-1907-18 {
  font-size: 27.671rpx;
  color: var(--cimoa-text-secondary);
  margin-top: 3.817rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.am-1909-19 { padding: 13.359rpx 20.993rpx; border-radius: 30.535rpx; flex: none; }
.am-1909-20 { font-size: 25.763rpx; font-weight: 600; }
@keyframes cRise {
  from { opacity: 0; transform: translateY(26.718rpx); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cPulse {
  0%,100% { transform: scale(0.94); opacity: 0.16; }
  50% { transform: scale(1.04); opacity: 0.3; }
}
</style>
