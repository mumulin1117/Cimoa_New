<script setup>
import {Teleport} from 'vue'
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import AutoMatchLeavingConfirmDialog from '@/components/AutoMatchLeavingConfirmDialog.vue'
import AutoMatchBoostConfirmDialog from '@/components/AutoMatchBoostConfirmDialog.vue'
import AutoMatchHelpConfirmDialog from '@/components/AutoMatchHelpConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,query,busy,is_loading,loading_label,guard,action,motion_style,prefs_source}=use_auto_match_page('searching')
</script>
<template>
<Teleport to="#cimoa-match-preferences-surface-source" :disabled="!prefs_source.borrowed.value">
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-searching" :scroll-locked="!!modal" :style="motion_style">
<template #header><view data-source-line="1613" class="am-1613-1"><view data-source-line="1614" class="am-1614-2" data-interaction="amSearching.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1615" class="am-1615-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1615" d="M15 5l-7 7 7 7"></path></svg></view><view data-source-line="1617" class="am-1617-5"></view><view data-source-line="1617" class="am-1617-6">Finding your match</view><view data-source-line="1617" class="am-1617-7" data-interaction="amSearching.openAmHelp.click.1" @click="action('openAmHelp',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openAmHelp',$event)"><svg data-source-line="1617" class="am-1617-8" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1617" cx="12" cy="12" r="9.5"></circle><path data-source-line="1617" d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.4 1-1.4 2.1"></path><path data-source-line="1617" d="M12 17.2h.01"></path></svg></view></view><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amSearching.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1619" class="am-1619-12"><view data-source-line="1620" class="am-1620-13"><view data-source-line="1621" class="am-1621-14"><view data-source-line="1622" class="am-1622-15"></view><view data-source-line="1623" class="am-1623-16"></view><view data-source-line="1624" class="am-1624-17"><view data-source-line="1625" class="am-1625-18"><UserAvatar data-source-line="1626" :src="c.me_img" :name="c.me.user_name" class="am-1626-19" /><UserAvatar data-source-line="1627" :src="c.search_avatar" :name="'Potential match'" class="am-1627-20" /></view></view></view></view><view data-source-line="1632" class="am-1632-21"><view data-source-line="1633" class="am-1633-22">Queue position</view><view data-source-line="1634" class="am-1634-23">{{ c.queue_pos }}</view><view data-source-line="1635" class="am-1635-24"><svg data-source-line="1636" class="am-1636-25" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-auto-match-match-wait-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1636" cx="12" cy="12" r="9"></circle><path data-source-line="1636" d="M12 7v5l3.2 2"></path></svg><view data-source-line="1637" class="am-1637-28">{{ c.wait_text }}</view></view><view data-source-line="1639" class="am-1639-29"></view><view data-source-line="1640" class="am-1640-30">Looking for someone who shares your interests.</view><view data-source-line="1641" class="am-1641-31" data-interaction="amSearching.openPrefs.click.1" @click="action('openPrefs',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openPrefs',$event)"><view data-source-line="1642" class="am-1642-32"><svg data-source-line="1642" class="am-1642-33" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1642" cx="9" cy="8" r="3.4"></circle><path data-source-line="1642" d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 20a5.6 5.6 0 0 0-2.2-4.4"></path></svg>{{ c.goal_label }}</view><view data-source-line="1643" class="am-1643-36"><svg data-source-line="1643" class="am-1643-37" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1643" d="M12 21s-7-6.2-7-11.4A7 7 0 0 1 19 9.6C19 14.8 12 21 12 21z"></path><circle data-source-line="1643" cx="12" cy="9.4" r="2.4"></circle></svg>{{ c.university_label }}</view><view data-source-line="1644" class="am-1644-40"><svg data-source-line="1644" class="am-1644-41" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1644" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg>{{ c.interest_label }}</view></view></view><template v-if="c.priority_on"><view data-source-line="1648" class="am-1648-44"><view data-source-line="1649" class="am-1649-45"></view><view data-source-line="1650" class="am-1650-46">{{ c.priority_timer }}</view></view></template><template v-if="c.priority_off"><view data-source-line="1654" class="am-1654-48" data-interaction="amSearching.openBoost.click.1" @click="action('openBoost',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openBoost',$event)"><view data-source-line="1655" class="am-1655-49"><svg data-source-line="1655" class="am-1655-50" viewBox="0 0 24 24" fill="var(--cimoa-auto-match-match-crown)"><path data-source-line="1655" d="M4 8l3 3 5-6 5 6 3-3-2 10H6z"></path></svg></view><view data-source-line="1656" class="am-1656-52"><view data-source-line="1656" class="am-1656-53">Priority Match · 20 coins</view><view data-source-line="1656" class="am-1656-54">Move closer to the front for 15 min</view></view><svg data-source-line="1657" class="am-1657-55" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-profile-chevron)" stroke-width="2.4" stroke-linecap="round"><path data-source-line="1657" d="M9 5l7 7-7 7"></path></svg></view></template><view data-source-line="1660" class="am-1660-57" data-interaction="amSearching.showNoMatch.click.1" @click="action('showNoMatch',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('showNoMatch',$event)">Nothing available? See options</view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1662" class="am-footer am-1662-58"><view data-source-line="1663" class="am-1663-59" data-interaction="amSearching.pauseQueue.click.1" @click="action('pauseQueue',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('pauseQueue',$event)"><view data-source-line="1663" class="am-1663-60">Pause</view></view><view data-source-line="1664" class="am-1664-61" data-interaction="amSearching.askLeave.click.1" @click="action('askLeave',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('askLeave',$event)">Leave Pool</view></view></template></template>
<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><AutoMatchLeavingConfirmDialog :open="modal === 'leaving'" :context="c" :busy="busy" @action="action" /><AutoMatchBoostConfirmDialog :open="modal === 'boost'" :context="c" :busy="busy" @action="action" /><AutoMatchHelpConfirmDialog :open="modal === 'help'" :context="c" :busy="busy" @action="action" /><EventActionLoading :visible="is_loading" :label="loading_label" /></template>
</SecondaryPageFrame>
</Teleport>
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
.am-1613-1 {
  height: 91.604rpx;
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 26.718rpx;
}
.am-1614-2 {
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
.am-1615-3 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1617-5 { flex: 1; }
.am-1617-6 {
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
.am-1617-7 {
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
.am-1617-8 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1619-12 { padding: 0 38.168rpx 45.802rpx; box-sizing: border-box; }
.am-1620-13 { display: flex; flex-direction: column; align-items: center; gap: 38.168rpx; margin-top: 34.352rpx; }
.am-1621-14 {
  position: relative;
  width: 351.146rpx;
  height: 351.146rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.am-1622-15 {
  position: absolute;
  inset: 0;
  border-radius: 175.573rpx;
  background: var(--cimoa-gradient-primary);
  opacity: 0.16;
  animation: cPulse var(--match-pulse-duration) ease-in-out infinite;
}
.am-1623-16 {
  position: absolute;
  inset: 49.619rpx;
  border-radius: 125.955rpx;
  background: var(--cimoa-gradient-primary);
  opacity: 0.22;
  animation: cPulse var(--match-pulse-duration) ease-in-out infinite var(--match-pulse-delay);
}
.am-1624-17 {
  width: 183.207rpx;
  height: 183.207rpx;
  border-radius: 91.604rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.am-1625-18 { display: flex; align-items: center; }
.am-1626-19 {
  width: 137.405rpx;
  height: 137.405rpx;
  border-radius: 68.703rpx;
  object-fit: cover;
  border: 3px solid var(--cimoa-surface-card);
  display: block;
  box-shadow: var(--cimoa-shadow-auto-match-57);
}
.am-1627-20 {
  width: 137.405rpx;
  height: 137.405rpx;
  border-radius: 68.703rpx;
  object-fit: cover;
  border: 3px solid var(--cimoa-surface-card);
  margin-left: -41.984rpx;
  display: block;
  box-shadow: var(--cimoa-shadow-auto-match-57);
}
.am-1632-21 {
  margin-top: 41.985rpx;
  padding: 41.985rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
  text-align: center;
}
.am-1633-22 { font-size: 27.671rpx; color: var(--cimoa-text-secondary); }
.am-1634-23 { font-size: 76.335rpx; font-weight: 800; letter-spacing: -0.03em; margin-top: 3.817rpx; }
.am-1635-24 {
  display: inline-flex;
  align-items: center;
  gap: 13.359rpx;
  height: 68.703rpx;
  padding: 0 30.535rpx;
  border-radius: 34.352rpx;
  background: var(--cimoa-auto-match-match-wait-pill);
  margin-top: 19.084rpx;
}
.am-1636-25 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1637-28 { font-size: 28.625rpx; font-weight: 700; color: var(--cimoa-auto-match-match-wait-ink); }
.am-1639-29 { height: 1.909rpx; background: var(--cimoa-surface-event-divider); margin: 34.352rpx 0; }
.am-1640-30 { font-size: 30.534rpx; color: var(--cimoa-text-profile-bio); text-wrap: pretty; }
.am-1641-31 {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 19.084rpx;
  margin-top: 26.718rpx;
  cursor: pointer;
}
.am-1642-32 {
  display: flex;
  align-items: center;
  gap: 13.359rpx;
  height: 72.52rpx;
  padding: 0 26.718rpx;
  border-radius: 36.26rpx;
  background: var(--cimoa-surface-settings-blue);
  color: var(--cimoa-auto-match-match-goal-ink);
  font-size: 28.625rpx;
  font-weight: 700;
}
.am-1642-33 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1643-36 {
  display: flex;
  align-items: center;
  gap: 13.359rpx;
  height: 72.52rpx;
  padding: 0 26.718rpx;
  border-radius: 36.26rpx;
  background: var(--cimoa-surface-settings-purple);
  color: var(--cimoa-auto-match-match-campus-ink);
  font-size: 28.625rpx;
  font-weight: 700;
}
.am-1643-37 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1644-40 {
  display: flex;
  align-items: center;
  gap: 13.359rpx;
  height: 72.52rpx;
  padding: 0 26.718rpx;
  border-radius: 36.26rpx;
  background: var(--cimoa-surface-event-people);
  color: var(--cimoa-text-event-people);
  font-size: 28.625rpx;
  font-weight: 700;
}
.am-1644-41 { width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1648-44 {
  display: flex;
  align-items: center;
  gap: 19.084rpx;
  margin-top: 22.901rpx;
  height: 99.237rpx;
  padding: 0 34.352rpx;
  border-radius: 49.619rpx;
  background: var(--cimoa-auto-match-match-priority-pill);
}
.am-1649-45 { width: 19.084rpx; height: 19.084rpx; border-radius: 9.542rpx; background: var(--cimoa-brand-purple); }
.am-1650-46 { font-size: 30.534rpx; font-weight: 700; color: var(--cimoa-auto-match-match-priority-ink); font-variant-numeric: tabular-nums; }
.am-1654-48 {
  display: flex;
  align-items: center;
  gap: 22.901rpx;
  margin-top: 22.901rpx;
  padding: 30.535rpx;
  background: var(--cimoa-surface-card);
  border-radius: 45.802rpx;
  box-shadow: var(--cimoa-shadow-card);
  cursor: pointer;
}
.am-1655-49 {
  width: 83.97rpx;
  height: 83.97rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-auto-match-match-crown-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.am-1655-50 { width: 41.985rpx; flex: none; height: 41.985rpx; flex: none; }
.am-1656-52 { flex: 1; min-width: 0; }
.am-1656-53 { font-size: 32.442rpx; font-weight: 700; }
.am-1656-54 { font-size: 27.671rpx; color: var(--cimoa-text-secondary); margin-top: 3.817rpx; }
.am-1657-55 { flex: none; width: 30.535rpx; flex: none; height: 30.535rpx; flex: none; }
.am-1660-57 { font-size: 27.671rpx; color: var(--cimoa-text-connection-muted); text-align: center; margin-top: 30.535rpx; cursor: pointer; }
.am-1662-58 {
  display: flex;
  flex-direction: column;
  gap: 11.451rpx;
  z-index: 20;
  padding: 0 38.168rpx 57.252rpx;
  flex: none;
}
.am-1663-59 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1663-60 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-1664-61 {
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
