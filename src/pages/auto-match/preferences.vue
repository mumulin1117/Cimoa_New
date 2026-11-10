<script setup>
import {nextTick,onMounted,onUnmounted,ref,Teleport} from 'vue'
import {onHide} from '@dcloudio/uni-app'
import {use_auto_match_page} from '@/composables/useAutoMatchPage.js'
import {bind_card_pointer_events as bind_pointer_events,create_pointer_gesture} from '@/utils/discoverSwipe.js'
import {nearest_range_bound,range_pointer_position,range_pointer_value,range_with_bound} from '@/utils/rangeSlider.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
import AutoMatchConfirmDialog from '@/components/AutoMatchConfirmDialog.vue'
import AutoMatchPreferenceConfirmDialog from '@/components/AutoMatchPreferenceConfirmDialog.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
const {frame,c,error,modal,draft,query,busy,is_loading,loading_label,guard,action,prefs_target}=use_auto_match_page('preferences')
const age_track=ref(null)
const range_configs=[
  {kind:'age',track:age_track,min:18,max:35,low:'age_min',high:'age_max',action:'onAgeTrack'},
  {kind:'height',min:140,max:200,low:'height_min',high:'height_max',action:'onHeightTrack'},
  {kind:'distance',min:0,max:100,value:'distance_max',action:'onDistanceTrack'},
]
const range_drags=new Map()
const range_element=config=>{
  const candidate=config.track?.value?.$el||config.track?.value
  return candidate?.addEventListener?candidate:globalThis.document?.querySelector(`[data-range="${config.kind}"]`)
}
const bind_range_drag=config=>{
  const element=range_element(config)
  if(range_drags.has(config.kind)||!element?.addEventListener)return
  let pointer_bound='',pointer_rect=null,start_values=null
  const can_drag=()=>!busy.value&&!!draft.value&&element.isConnected
  const pointer_value=(client_x,snap=false)=>(snap?range_pointer_value:range_pointer_position)({client_x,left:pointer_rect.left,width:pointer_rect.width,inset:uni.upx2px(38.168),min:config.min,max:config.max})
  const update=(client_x,snap=false)=>{
    if(!draft.value||!pointer_rect)return
    const value=pointer_value(client_x,snap)
    if(config.value){draft.value[config.value]=value;return}
    if(!['min','max'].includes(pointer_bound))return
    const next=range_with_bound({bound:pointer_bound,value,low:draft.value[config.low],high:draft.value[config.high]})
    draft.value[config.low]=next.low;draft.value[config.high]=next.high
  }
  const reset=()=>{pointer_rect=null;pointer_bound='';start_values=null}
  const restore=()=>{if(start_values&&draft.value){if(config.value)draft.value[config.value]=start_values.value;else{draft.value[config.low]=start_values.low;draft.value[config.high]=start_values.high}}reset()}
  const gesture=create_pointer_gesture({element:()=>range_element(config),can_start:can_drag,can_continue:can_drag,capture:'horizontal',cancel_vertical:true,slop:()=>2,horizontal_bias:.7,
    start:({clientX})=>{pointer_rect=element.getBoundingClientRect();start_values=config.value?{value:draft.value[config.value]}:{low:draft.value[config.low],high:draft.value[config.high]};const value=pointer_value(clientX);if(config.value)pointer_bound='value';else if(!['min','max'].includes(pointer_bound))pointer_bound=nearest_range_bound(value,draft.value[config.low],draft.value[config.high])},
    move:({clientX,axis})=>{if(axis==='horizontal')update(clientX)},
    end:({clientX})=>{update(clientX,true);reset()},
    cancel:restore,
  })
  const dispose_pointer=bind_pointer_events(element,{
    start:event=>{pointer_bound=event.target?.closest?.('[data-range-bound]')?.dataset.rangeBound||'';gesture.start(event)},
    move:gesture.move,end:gesture.end,cancel:gesture.cancel,additional:gesture.additional,
  })
  const suppress_drag_click=event=>{if(gesture.can_click()===false){event.preventDefault();event.stopImmediatePropagation()}}
  element.addEventListener('click',suppress_drag_click,{capture:true})
  const dispose=()=>{dispose_pointer();element.removeEventListener('click',suppress_drag_click,{capture:true})}
  range_drags.set(config.kind,{gesture,dispose})
}
const cancel_range_drags=()=>range_drags.forEach(({gesture})=>gesture.cancel())
const on_range_track_click=(config,event)=>{if(range_drags.get(config.kind)?.gesture.can_click()!==false)return action(config.action,event)}
const on_age_track_click=event=>on_range_track_click(range_configs[0],event)
onMounted(()=>nextTick(()=>range_configs.forEach(bind_range_drag)))
onHide(cancel_range_drags)
onUnmounted(()=>{cancel_range_drags();range_drags.forEach(({dispose})=>dispose());range_drags.clear()})
</script>
<template>
<Teleport to="#cimoa-match-preferences-surface-target" :disabled="!prefs_target.borrowed.value">
<SecondaryPageFrame ref="frame" class="auto-match-page auto-match-preferences" :surface-motion="prefs_target.surface_mode.value" :style="prefs_target.style.value" :aria-busy="busy" :inert="prefs_target.busy.value ? '' : undefined" :scroll-locked="!!modal">
<template #header><view data-source-line="1513" class="am-1513-1"><view data-source-line="1514" class="am-1514-2" data-interaction="amPrefs.goBack.click.1" @click="action('goBack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('goBack',$event)" aria-label="Back"><svg data-source-line="1515" class="am-1515-3" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="2.4" stroke-linecap="round"><path data-source-line="1515" d="M6 6l12 12M18 6 6 18"></path></svg></view><view data-source-line="1517" class="am-1517-5">Match Preferences</view></view><FeedbackToast v-if="error" :message="error" @dismiss="error = String()" /></template>
<view v-if="guard" class="am-error" role="alert">{{ guard }}<view role="button" tabindex="0" data-interaction="amPrefs.returnHome.error.click.1" @click="action('returnHome')" @keydown.enter="action('returnHome')">Return Home</view></view>
<template v-else><view data-source-line="1519" class="am-1519-6"><view data-source-line="1521" class="am-1521-7"><view data-source-line="1522" class="am-1522-8"><svg data-source-line="1522" class="am-1522-9" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect data-source-line="1522" x="3" y="5" width="18" height="16" rx="3"></rect><path data-source-line="1522" d="M8 3v3M16 3v3M3 10h18"></path></svg><view data-source-line="1522" class="am-1522-12">Age Range</view></view><view data-source-line="1523" class="am-1523-13">{{ c.age_label }}</view></view><view ref="age_track" data-source-line="1525" class="am-1525-14" data-interaction="amPrefs.onAgeTrack.click.1" @click="on_age_track_click" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('onAgeTrack',$event)" data-range="age" :aria-label="`Age range ${c.age_label}. Drag either handle; Enter switches bound and arrows adjust.`" @keydown.left.prevent="action('onAgeTrack',$event)" @keydown.right.prevent="action('onAgeTrack',$event)"><view data-source-line="1526" class="am-1526-15"><view data-source-line="1527" class="am-1527-16" :style="{'left':`${c.age_min_pct}%`,'right':`${c.age_max_pct_inv}%`}"></view><view data-source-line="1528" class="am-1528-17" data-range-bound="min" :style="{'left':`${c.age_min_pct}%`}"></view><view data-source-line="1529" class="am-1529-18" data-range-bound="max" :style="{'left':`${c.age_max_pct}%`}"></view></view></view><view data-source-line="1533" class="am-1533-19" data-interaction="amPrefs.openUniPicker.click.1" @click="action('openUniPicker',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openUniPicker',$event)"><svg data-source-line="1534" class="am-1534-20" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1534" d="M2 8.5l10-4.5 10 4.5-10 4.5z"></path><path data-source-line="1534" d="M6 10.8v4.4c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4"></path><path data-source-line="1534" d="M22 8.5v5"></path></svg><view data-source-line="1534" class="am-1534-24">University</view></view><view data-source-line="1536" class="am-1536-25" data-interaction="amPrefs.openUniPicker.click.2" @click="action('openUniPicker',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openUniPicker',$event)"><view data-source-line="1537" class="am-1537-26">{{ c.pref_university }}</view><svg data-source-line="1538" class="am-1538-27" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-profile-chevron)" stroke-width="2.4" stroke-linecap="round"><path data-source-line="1538" d="M9 5l7 7-7 7"></path></svg></view><view data-source-line="1541" class="am-1541-29"><svg data-source-line="1541" class="am-1541-30" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1541" d="M2 6l10 4 10-4-10-4z"></path><path data-source-line="1541" d="M2 6v12l10 4 10-4V6"></path><path data-source-line="1541" d="M12 10v10"></path></svg><view data-source-line="1541" class="am-1541-34">Degree / Major</view></view><view data-source-line="1542" class="am-1542-35"><template v-for="o in c.major_chips" :key="o.value || o.match_id || o.item_id"><view data-source-line="1544" class="am-1544-37" :style="{'background':`${o.bg}`,'color':`${o.ink}`}" data-interaction="amPrefs.o.pick.click.1" @click="action('pick',$event,o)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('pick',$event,o)">{{ o.label }}</view></template></view><view data-source-line="1548" class="am-1548-38"><view data-source-line="1549" class="am-1549-39"><svg data-source-line="1549" class="am-1549-40" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle data-source-line="1549" cx="12" cy="8.5" r="3.8"></circle><path data-source-line="1549" d="M4.5 20c1.4-4.2 5-6 7.5-6s6.1 1.8 7.5 6"></path></svg><view data-source-line="1549" class="am-1549-43">Height Range</view></view><view data-source-line="1550" class="am-1550-44">{{ c.height_label }}</view></view><view data-source-line="1552" class="am-1552-45" data-interaction="amPrefs.onHeightTrack.click.1" @click="action('onHeightTrack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('onHeightTrack',$event)" data-range="height" aria-label="Adjust range; Enter switches bound, arrows adjust" @keydown.left.prevent="action('onHeightTrack',$event)" @keydown.right.prevent="action('onHeightTrack',$event)"><view data-source-line="1553" class="am-1553-46"><view data-source-line="1554" class="am-1554-47" :style="{'left':`${c.height_min_pct}%`,'right':`${c.height_max_pct_inv}%`}"></view><view data-source-line="1555" class="am-1555-48" :style="{'left':`${c.height_min_pct}%`}"></view><view data-source-line="1556" class="am-1556-49" :style="{'left':`${c.height_max_pct}%`}"></view></view></view><view data-source-line="1560" class="am-1560-50"><view data-source-line="1561" class="am-1561-51"><svg data-source-line="1561" class="am-1561-52" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1561" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path></svg><view data-source-line="1561" class="am-1561-54">Interests</view></view><view data-source-line="1562" class="am-1562-55"><view data-source-line="1562" class="am-1562-56">{{ c.interest_count2 }}/5 selected</view><view data-source-line="1562" class="am-1562-57" data-interaction="amPrefs.clearInterests.click.1" @click="action('clearInterests',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('clearInterests',$event)">Clear</view></view></view><view data-source-line="1564" class="am-1564-58" data-interaction="amPrefs.openInterestsPicker.click.1" @click="action('openInterestsPicker',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('openInterestsPicker',$event)"><view data-source-line="1565" class="am-1565-59">{{ c.interest_count2 }}/5 selected</view><svg data-source-line="1566" class="am-1566-60" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-text-profile-chevron)" stroke-width="2.4" stroke-linecap="round"><path data-source-line="1566" d="M9 5l7 7-7 7"></path></svg></view><view data-source-line="1568" class="am-1568-62"><template v-for="o in c.selected_interest_chips" :key="o.value || o.match_id || o.item_id"><view data-source-line="1570" class="am-1570-64">{{ o.emoji }} {{ o.label }}</view></template></view><view data-source-line="1574" class="am-1574-65"><svg data-source-line="1574" class="am-1574-66" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1574" d="M4 4h16l-2 8a6 6 0 0 1-12 0z"></path><path data-source-line="1574" d="M12 16v5M8 20h8"></path></svg><view data-source-line="1574" class="am-1574-69">MBTI Personality</view></view><view data-source-line="1575" class="am-1575-70"><template v-for="o in c.mbti_chips" :key="o.value || o.match_id || o.item_id"><view data-source-line="1577" class="am-1577-72" :style="{'background':`${o.bg}`,'color':`${o.ink}`}" data-interaction="amPrefs.o.pick.click.2" @click="action('pick',$event,o)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('pick',$event,o)">{{ o.label }}</view></template></view><view data-source-line="1581" class="am-1581-73"><svg data-source-line="1581" class="am-1581-74" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1581" d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"></path></svg><view data-source-line="1581" class="am-1581-76">Religion</view></view><view data-source-line="1582" class="am-1582-77"><template v-for="o in c.religion_chips" :key="o.value || o.match_id || o.item_id"><view data-source-line="1584" class="am-1584-79" :style="{'background':`${o.bg}`,'color':`${o.ink}`}" data-interaction="amPrefs.o.pick.click.3" @click="action('pick',$event,o)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('pick',$event,o)">{{ o.label }}</view></template></view><view data-source-line="1588" class="am-1588-80"><svg data-source-line="1588" class="am-1588-81" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1588" d="M8 3h8l-1 6-3 3-3-3z"></path><path data-source-line="1588" d="M12 12v8M8 20h8"></path></svg><view data-source-line="1588" class="am-1588-84">Drinking Habits</view></view><view data-source-line="1589" class="am-1589-85"><template v-for="o in c.drink_chips" :key="o.value || o.match_id || o.item_id"><view data-source-line="1591" class="am-1591-87" :style="{'background':`${o.bg}`,'color':`${o.ink}`}" data-interaction="amPrefs.o.pick.click.4" @click="action('pick',$event,o)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('pick',$event,o)">{{ o.label }}</view></template></view><view data-source-line="1595" class="am-1595-88"><view data-source-line="1596" class="am-1596-89"><svg data-source-line="1596" class="am-1596-90" viewBox="0 0 24 24" fill="none" stroke="var(--cimoa-icon-primary)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path data-source-line="1596" d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"></path><circle data-source-line="1596" cx="12" cy="10" r="2.6"></circle></svg><view data-source-line="1596" class="am-1596-93">Distance</view></view><view data-source-line="1597" class="am-1597-94">{{ c.distance_label }}</view></view><view data-source-line="1599" class="am-1599-95" data-interaction="amPrefs.onDistanceTrack.click.1" @click="action('onDistanceTrack',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('onDistanceTrack',$event)" data-range="distance" aria-label="Adjust range; Enter switches bound, arrows adjust" @keydown.left.prevent="action('onDistanceTrack',$event)" @keydown.right.prevent="action('onDistanceTrack',$event)"><view data-source-line="1600" class="am-1600-96"><view data-source-line="1601" class="am-1601-97" :style="{'right':`${c.distance_pct_inv}%`}"></view><view data-source-line="1602" class="am-1602-98" :style="{'left':`${c.distance_pct}%`}"></view></view></view></view></template>
<template #footer><template v-if="!guard"><view data-source-line="1606" class="am-footer am-1606-99"><view data-source-line="1606" class="am-1606-100" data-interaction="amPrefs.savePrefs.click.1" @click="action('savePrefs',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('savePrefs',$event)"><view data-source-line="1606" class="am-1606-101">Save</view></view></view></template></template>
<template #overlays><AutoMatchConfirmDialog :modal="modal" :context="c" :busy="busy" @action="action" /><AutoMatchPreferenceConfirmDialog :modal="modal" :context="c" :query="query" :busy="busy" @action="action" /><EventActionLoading :visible="is_loading" :label="loading_label" /></template>
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
.am-1513-1 {
  height: 91.604rpx;
  min-height: var(--app-touch-target);
  display: flex;
  align-items: center;
  z-index: 20;
  position: relative;
  margin: 7.634rpx 38.168rpx 22.901rpx;
}
.am-1514-2 {
  width: 87.787rpx;
  height: 87.787rpx;
  min-width: var(--app-touch-target);
  min-height: var(--app-touch-target);
  border-radius: 43.894rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
}
.am-1515-3 { width: 38.168rpx; flex: none; height: 38.168rpx; flex: none; }
.am-1517-5 {
  flex: 1;
  text-align: center;
  font-size: 40.076rpx;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin-right: 87.787rpx;
}
.am-1519-6 { padding: 0 38.168rpx 45.802rpx; box-sizing: border-box; }
.am-1521-7 { display: flex; align-items: center; justify-content: space-between; margin-top: 11.451rpx; }
.am-1522-8 { display: flex; align-items: center; gap: 19.084rpx; }
.am-1522-9 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1522-12 { font-size: 36.259rpx; font-weight: 700; }
.am-1523-13 { font-size: 28.625rpx; color: var(--cimoa-text-connection-muted); }
.am-1525-14 {
  position: relative;
  height: 106.871rpx;
  margin-top: 22.901rpx;
  padding: 0 38.168rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-tinted);
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.am-1526-15 { position: relative; width: 100%; height: 9.542rpx; border-radius: 5.726rpx; background: var(--cimoa-surface-event-handle); }
.am-1527-16 { position: absolute; height: 9.542rpx; border-radius: 5.726rpx; background: var(--cimoa-gradient-auto-match-16); }
.am-1528-17 {
  position: absolute;
  top: 50%;
  width: 45.802rpx;
  height: 45.802rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auto-match-55);
  border: 3px solid var(--cimoa-brand-purple);
  transform: translate(-50%,-50%);
}
.am-1529-18 {
  position: absolute;
  top: 50%;
  width: 45.802rpx;
  height: 45.802rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auto-match-55);
  border: 3px solid var(--cimoa-brand-purple);
  transform: translate(-50%,-50%);
}
.am-1533-19 { display: flex; align-items: center; gap: 19.084rpx; margin-top: 49.619rpx; cursor: pointer; }
.am-1534-20 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1534-24 { font-size: 36.259rpx; font-weight: 700; }
.am-1536-25 {
  display: flex;
  align-items: center;
  height: 106.871rpx;
  padding: 0 34.352rpx;
  margin-top: 22.901rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-tinted);
  cursor: pointer;
}
.am-1537-26 { flex: 1; font-size: 32.442rpx; font-weight: 600; }
.am-1538-27 { width: 32.443rpx; flex: none; height: 32.443rpx; flex: none; }
.am-1541-29 { display: flex; align-items: center; gap: 19.084rpx; margin-top: 49.619rpx; }
.am-1541-30 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1541-34 { font-size: 36.259rpx; font-weight: 700; }
.am-1542-35 { display: flex; flex-wrap: wrap; gap: 19.084rpx; margin-top: 22.901rpx; }
.am-1544-37 {
  height: 87.787rpx;
  padding: 0 34.352rpx;
  border-radius: 43.894rpx;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 30.534rpx;
  font-weight: 600;
  box-shadow: var(--cimoa-shadow-auto-match-56);
}
.am-1548-38 { display: flex; align-items: center; justify-content: space-between; margin-top: 49.619rpx; }
.am-1549-39 { display: flex; align-items: center; gap: 19.084rpx; }
.am-1549-40 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1549-43 { font-size: 36.259rpx; font-weight: 700; }
.am-1550-44 { font-size: 28.625rpx; color: var(--cimoa-text-connection-muted); }
.am-1552-45 {
  position: relative;
  height: 106.871rpx;
  margin-top: 22.901rpx;
  padding: 0 38.168rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-tinted);
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.am-1553-46 { position: relative; width: 100%; height: 9.542rpx; border-radius: 5.726rpx; background: var(--cimoa-surface-event-handle); }
.am-1554-47 { position: absolute; height: 9.542rpx; border-radius: 5.726rpx; background: var(--cimoa-gradient-auto-match-16); }
.am-1555-48 {
  position: absolute;
  top: 50%;
  width: 45.802rpx;
  height: 45.802rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auto-match-55);
  border: 3px solid var(--cimoa-brand-purple);
  transform: translate(-50%,-50%);
}
.am-1556-49 {
  position: absolute;
  top: 50%;
  width: 45.802rpx;
  height: 45.802rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auto-match-55);
  border: 3px solid var(--cimoa-brand-purple);
  transform: translate(-50%,-50%);
}
.am-1560-50 { display: flex; align-items: center; justify-content: space-between; margin-top: 49.619rpx; }
.am-1561-51 { display: flex; align-items: center; gap: 19.084rpx; }
.am-1561-52 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1561-54 { font-size: 36.259rpx; font-weight: 700; }
.am-1562-55 { display: flex; align-items: center; gap: 19.084rpx; }
.am-1562-56 { font-size: 28.625rpx; color: var(--cimoa-text-connection-muted); }
.am-1562-57 { font-size: 28.625rpx; font-weight: 600; color: var(--cimoa-text-link); cursor: pointer; }
.am-1564-58 {
  display: flex;
  align-items: center;
  height: 106.871rpx;
  padding: 0 34.352rpx;
  margin-top: 22.901rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-tinted);
  cursor: pointer;
}
.am-1565-59 { flex: 1; font-size: 32.442rpx; font-weight: 600; }
.am-1566-60 { width: 32.443rpx; flex: none; height: 32.443rpx; flex: none; }
.am-1568-62 { display: flex; flex-wrap: wrap; gap: 19.084rpx; margin-top: 19.084rpx; }
.am-1570-64 {
  height: 83.97rpx;
  padding: 0 30.535rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auto-match-56);
  display: flex;
  align-items: center;
  gap: 11.451rpx;
  font-size: 30.534rpx;
  font-weight: 600;
}
.am-1574-65 { display: flex; align-items: center; gap: 19.084rpx; margin-top: 49.619rpx; }
.am-1574-66 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1574-69 { font-size: 36.259rpx; font-weight: 700; }
.am-1575-70 { display: flex; flex-wrap: wrap; gap: 19.084rpx; margin-top: 22.901rpx; }
.am-1577-72 {
  height: 87.787rpx;
  padding: 0 34.352rpx;
  border-radius: 43.894rpx;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 30.534rpx;
  font-weight: 600;
  box-shadow: var(--cimoa-shadow-auto-match-56);
}
.am-1581-73 { display: flex; align-items: center; gap: 19.084rpx; margin-top: 49.619rpx; }
.am-1581-74 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1581-76 { font-size: 36.259rpx; font-weight: 700; }
.am-1582-77 { display: flex; flex-wrap: wrap; gap: 19.084rpx; margin-top: 22.901rpx; }
.am-1584-79 {
  height: 87.787rpx;
  padding: 0 34.352rpx;
  border-radius: 43.894rpx;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 30.534rpx;
  font-weight: 600;
  box-shadow: var(--cimoa-shadow-auto-match-56);
}
.am-1588-80 { display: flex; align-items: center; gap: 19.084rpx; margin-top: 49.619rpx; }
.am-1588-81 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1588-84 { font-size: 36.259rpx; font-weight: 700; }
.am-1589-85 { display: flex; flex-wrap: wrap; gap: 19.084rpx; margin-top: 22.901rpx; }
.am-1591-87 {
  height: 87.787rpx;
  padding: 0 34.352rpx;
  border-radius: 43.894rpx;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 30.534rpx;
  font-weight: 600;
  box-shadow: var(--cimoa-shadow-auto-match-56);
}
.am-1595-88 { display: flex; align-items: center; justify-content: space-between; margin-top: 49.619rpx; }
.am-1596-89 { display: flex; align-items: center; gap: 19.084rpx; }
.am-1596-90 { width: 49.619rpx; flex: none; height: 49.619rpx; flex: none; }
.am-1596-93 { font-size: 36.259rpx; font-weight: 700; }
.am-1597-94 { font-size: 28.625rpx; color: var(--cimoa-text-connection-muted); }
.am-1599-95 {
  position: relative;
  height: 106.871rpx;
  margin-top: 22.901rpx;
  padding: 0 38.168rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-tinted);
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
}
.am-1600-96 { position: relative; width: 100%; height: 9.542rpx; border-radius: 5.726rpx; background: var(--cimoa-surface-event-handle); }
.am-1601-97 { position: absolute; height: 9.542rpx; border-radius: 5.726rpx; background: var(--cimoa-gradient-auto-match-16); left: 0; }
.am-1602-98 {
  position: absolute;
  top: 50%;
  width: 45.802rpx;
  height: 45.802rpx;
  border-radius: 22.901rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auto-match-55);
  border: 3px solid var(--cimoa-brand-purple);
  transform: translate(-50%,-50%);
}
.am-1606-99 { z-index: 20; padding: 0 38.168rpx 64.886rpx; flex: none; }
.am-1606-100 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-1606-101 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
@keyframes cPulse {
  0%,100% { transform: scale(0.94); opacity: 0.16; }
  50% { transform: scale(1.04); opacity: 0.3; }
}
</style>
