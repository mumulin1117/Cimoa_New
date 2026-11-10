<script setup>
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import AutoMatchAcceptingConfirmDialog from '@/components/AutoMatchAcceptingConfirmDialog.vue'
import AutoMatchFoundLeaveConfirmDialog from '@/components/AutoMatchFoundLeaveConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,loading_label,guard,action,motion_style}=use_auto_match_page('found')
</script>
<template>
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-found" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1707" class="am-1707-1"><view data-source-line="1708" class="am-1708-2" data-interaction="amFound.askLeaveMatch.click.1" @click="action('askLeaveMatch',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('askLeaveMatch',$event)" aria-label="Back"><svg data-source-line="1709" class="am-1709-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1709" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1711" class="am-1711-5"><svg data-source-line="1712" class="am-1712-6" viewBox="0 0 26 18" fill="none" stroke-linecap="round"><path data-source-line="1712" d="M6 12 3 2" stroke="var(--cimoa-brand-cyan)" stroke-width="2.4"></path><path data-source-line="1712" d="M13 10V1" stroke="var(--cimoa-brand-connection-violet)" stroke-width="2.4"></path><path data-source-line="1712" d="M20 12l3-10" stroke="var(--cimoa-brand-pink)" stroke-width="2.4"></path></svg><view data-source-line="1713" class="am-1713-10">Match found</view></view><view data-source-line="1715" class="am-1715-11"><svg data-source-line="1716" class="am-1716-12" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-auto-match-match-deadline-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1716" cx="12" cy="12" r="9"></circle><path data-source-line="1716" d="M12 7v5l3.2 2"></path></svg><view data-source-line="1717" class="am-1717-15">{{ c.found_timer }}</view></view></view><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amFound.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1720" class="am-1720-16"><view data-source-line="1721" class="am-1721-17" data-interaction="amFound.openLimitedProfile.click.1" @click="action('openLimitedProfile',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openLimitedProfile',$event)"><ProfilePhoto data-source-line="1722" :src="c.am_img" :name="c.person_name" position="50% 26%" class="am-1722-18" /><view data-source-line="1723" class="am-1723-19"></view><view data-source-line="1724" class="am-1724-20"><view data-source-line="1725" class="am-1725-21"><view data-source-line="1726" class="am-1726-22">{{ c.am_name }}</view><svg data-source-line="1727" v-if="c.candidate_verified" class="am-1727-23" viewBox="0 0 24 24" fill="none"><circle data-source-line="1727" cx="12" cy="12" r="11" fill="var(--cimoa-status-verified)"></circle><path data-source-line="1727" d="m7.5 12.4 3 3 6-6.4" stroke="var(--cimoa-surface-card)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg></view><view data-source-line="1729" class="am-1729-26"><view data-source-line="1730" class="am-1730-27"><svg data-source-line="1731" class="am-1731-28" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-surface-card)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1731" d="M2 8.5l10-4.5 10 4.5-10 4.5z"></path><path data-source-line="1731" d="M6 10.8v4.4c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4"></path><path data-source-line="1731" d="M22 8.5v5"></path></svg><view data-source-line="1732" class="am-1732-32">{{ c.am_uni }}</view></view><view data-source-line="1734" class="am-1734-33"><svg data-source-line="1735" class="am-1735-34" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-surface-card)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1735" d="M2.5 5.5c3.2-1 6.3-.7 9.5 1.2 3.2-1.9 6.3-2.2 9.5-1.2v13c-3.2-1-6.3-.7-9.5 1.2-3.2-1.9-6.3-2.2-9.5-1.2z"></path><path data-source-line="1735" d="M12 6.7v13"></path></svg><view data-source-line="1736" class="am-1736-37">{{ c.am_major }}</view></view><view data-source-line="1738" class="am-1738-38"><svg data-source-line="1739" class="am-1739-39" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-surface-card)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1739" d="M9.2 3.8a2.3 2.3 0 0 1 4.6 0V5H17a1 1 0 0 1 1 1v3.3h1.2a2.3 2.3 0 0 1 0 4.6H18V18a1 1 0 0 1-1 1h-3.3v-1.2a2.3 2.3 0 0 0-4.6 0V19H6a1 1 0 0 1-1-1v-3.4h1.2a2.3 2.3 0 0 0 0-4.6H5V6a1 1 0 0 1 1-1h3.2z"></path></svg><view data-source-line="1740" class="am-1740-41">{{ c.am_mbti }}</view></view></view></view></view><view data-source-line="1746" class="am-1746-42">{{ c.shared_title }}</view><view data-source-line="1747" class="am-1747-43">{{ c.shared_copy }}</view><view data-source-line="1748" class="am-shared"><view v-for="i in c.shared_chips" :key="i.item_id" class="am-interest" :style="{background:i.bg,color:i.ink}"><view class="am-emoji">{{ i.emoji }}</view><view>{{ i.label }}</view></view></view><view data-source-line="1753" class="am-1753-45"></view><view data-source-line="1754" class="am-1754-46">{{ c.am_bio }}</view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1756" class="am-footer am-1756-47"><view data-source-line="1757" class="am-1757-48"><view data-source-line="1758" class="am-1758-49" data-interaction="amFound.connectAsk.click.1" @click="action('connectAsk',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('connectAsk',$event)"><view data-source-line="1758" class="am-1758-50">Connect</view></view><view data-source-line="1759" class="am-1759-51" data-interaction="amFound.passMatch.click.1" @click="action('passMatch',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('passMatch',$event)" aria-label="Skip match"><svg data-source-line="1759" class="am-1759-52" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="3" stroke-linecap="round"><path data-source-line="1759" d="M6 6l12 12M18 6 6 18"></path></svg></view></view><view data-source-line="1761" class="am-1761-54" data-interaction="amFound.openLimitedProfile.click.2" @click="action('openLimitedProfile',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openLimitedProfile',$event)">View profile</view></view></template></template>
<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><AutoMatchAcceptingConfirmDialog :open="modal === 'accepting'" :context="c" :busy="busy" @action="action" /><AutoMatchFoundLeaveConfirmDialog :open="modal === 'found-leave'" :context="c" :busy="busy" @action="action" /><EventActionLoading :visible="is_loading" :label="loading_label" /></template>
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
.am-1707-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 22.901rpx;
}
.am-1708-2 {
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
.am-1709-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1711-5 { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3.817rpx; }
.am-1712-6 { width: 49.619rpx; flex: none; height: 34.352rpx; flex: none; }
.am-1713-10 { font-size: 40.076rpx; font-weight: 700; letter-spacing: -0.025em; }
.am-1715-11 {
  display: flex;
  align-items: center;
  gap: 13.359rpx;
  height: 72.52rpx;
  padding: 0 26.718rpx;
  border-radius: 36.26rpx;
  background: var(--cimoa-auto-match-match-deadline-pill);
  flex: none;
}
.am-1716-12 { width: 28.626rpx; flex: none; height: 28.626rpx; flex: none; }
.am-1717-15 { font-size: 28.625rpx; font-weight: 700; color: var(--cimoa-auto-match-match-deadline-ink); font-variant-numeric: tabular-nums; }
.am-1720-16 { padding: 0 38.168rpx 45.802rpx; box-sizing: border-box; }
.am-1721-17 {
  position: relative;
  width: 100%;
  height: 648.855rpx;
  border-radius: 45.802rpx;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-photo);
}
.am-1722-18 { width: 100%; height: 100%; object-fit: cover; object-position: 50% 26%; display: block; }
.am-1723-19 {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 286.26rpx;
  background: var(--cimoa-gradient-auto-match-17);
}
.am-1724-20 { position: absolute; left: 38.168rpx; right: 38.168rpx; bottom: 30.535rpx; color: var(--cimoa-text-inverse); }
.am-1725-21 { display: flex; align-items: center; gap: 15.268rpx; min-width: 0; }
.am-1726-22 { font-size: 51.526rpx; font-weight: 800; letter-spacing: -0.03em; min-width: 0; overflow-wrap: anywhere; }
.am-1727-23 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1729-26 { display: flex; flex-wrap: wrap; gap: 13.359rpx; margin-top: 19.084rpx; }
.am-1730-27 {
  display: flex;
  align-items: center;
  gap: 11.451rpx;
  min-height: 68.703rpx;
  max-width: 100%;
  padding: 0 22.901rpx;
  border-radius: 34.352rpx;
  flex: none;
  background: var(--cimoa-surface-photo-tag);
  border: 1px solid var(--cimoa-surface-photo-tag-border);
  backdrop-filter: blur(15.268rpx);
}
.am-1731-28 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1732-32 {
  font-size: 28.625rpx;
  font-weight: 600;
  color: var(--cimoa-text-inverse);
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 0;
  padding: 10rpx 0;
}
.am-1734-33 {
  display: flex;
  align-items: center;
  gap: 11.451rpx;
  min-height: 68.703rpx;
  max-width: 100%;
  padding: 0 22.901rpx;
  border-radius: 34.352rpx;
  flex: none;
  background: var(--cimoa-surface-photo-tag);
  border: 1px solid var(--cimoa-surface-photo-tag-border);
  backdrop-filter: blur(15.268rpx);
}
.am-1735-34 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1736-37 {
  font-size: 28.625rpx;
  font-weight: 600;
  color: var(--cimoa-text-inverse);
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 0;
  padding: 10rpx 0;
}
.am-1738-38 {
  display: flex;
  align-items: center;
  gap: 11.451rpx;
  min-height: 68.703rpx;
  max-width: 100%;
  padding: 0 22.901rpx;
  border-radius: 34.352rpx;
  flex: none;
  background: var(--cimoa-surface-photo-tag);
  border: 1px solid var(--cimoa-surface-photo-tag-border);
  backdrop-filter: blur(15.268rpx);
}
.am-1739-39 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1740-41 {
  font-size: 28.625rpx;
  font-weight: 600;
  color: var(--cimoa-text-inverse);
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 0;
  padding: 10rpx 0;
}
.am-1746-42 { font-size: 49.618rpx; font-weight: 800; letter-spacing: -0.025em; margin-top: 41.985rpx; }
.am-1747-43 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); margin-top: 11.451rpx; }
.am-1753-45 { height: 1.909rpx; background: var(--cimoa-surface-event-divider); margin: 34.352rpx 0; }
.am-1754-46 { font-size: 32.442rpx; color: var(--cimoa-text-profile-bio); line-height: 1.45; text-wrap: pretty; }
.am-1756-47 {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26.718rpx;
  z-index: 20;
  padding: 0 38.168rpx 57.252rpx;
  flex: none;
}
.am-1757-48 { display: flex; gap: 22.901rpx; width: 100%; }
.am-1758-49 {
  flex: 1;
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1758-50 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-1759-51 {
  width: 114.504rpx;
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-connection-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
.am-1759-52 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1761-54 { font-size: 30.534rpx; font-weight: 600; color: var(--cimoa-text-link); cursor: pointer; }
@keyframes cRise {
  from { opacity: 0; transform: translateY(26.718rpx); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes cPulse {
  0%,100% { transform: scale(0.94); opacity: 0.16; }
  50% { transform: scale(1.04); opacity: 0.3; }
}
</style>
