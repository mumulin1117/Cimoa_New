<script setup>
import {computed} from 'vue'
import EventConfirmDialog from './EventConfirmDialog.vue'
import UserAvatar from './UserAvatar.vue'
const props=defineProps({open:Boolean,busy:Boolean,context:Object}),emit=defineEmits(['action'])
const c=computed(()=>props.context||{}),busy=computed(()=>props.busy)
const action=(name,event,row)=>{if(!busy.value)emit('action',({getCoins2:'getCoins',freeAlt:'standardMatch'})[name]||name,event,row)}
</script>
<template><view class="match-source-sheet"><EventConfirmDialog :open="open" :busy="busy" label="Auto Match / Found / Accepting" close-interaction="sheetAccepting.closeSheet.click.1" @close="action('closeSheet')"><view data-source-line="4375" class="am-4375-1"><UserAvatar data-source-line="4376" :src="c.candidate_avatar" :name="c.person_name" class="am-4376-2" /><view data-source-line="4377" class="am-4377-3">{{ c.connect_title }}</view></view><view data-source-line="4379" class="am-4379-4">{{ c.connect_copy }}</view><view data-source-line="4380" class="am-4380-5" data-interaction="sheetAccepting.confirmConnect.click.1" @click="action('confirmConnect',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('confirmConnect',$event)"><view data-source-line="4380" class="am-4380-6">Confirm</view></view><view data-source-line="4381" class="am-4381-7" data-interaction="sheetAccepting.closeSheet.click.2" @click="action('closeSheet',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('closeSheet',$event)"><view data-source-line="4381" class="am-4381-8">Not Yet</view></view></EventConfirmDialog></view></template>
<style scoped>
.match-source-sheet { --event-dialog-bottom: 0px; line-height: normal; -webkit-font-smoothing: antialiased; }
.match-source-sheet :deep(.event-dialog-panel) { padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.am-4375-1 { display: flex; align-items: center; gap: 26.718rpx; }
.am-4376-2 {
  width: 106.871rpx;
  height: 106.871rpx;
  border-radius: 53.436rpx;
  object-fit: cover;
  display: block;
  flex: none;
}
.am-4377-3 { font-size: 47.709rpx; font-weight: 800; letter-spacing: -0.03em; }
.am-4379-4 { font-size: 30.534rpx; color: var(--cimoa-text-secondary); margin-top: 22.901rpx; text-wrap: pretty; }
.am-4380-5 {
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 38.168rpx;
  box-shadow: var(--cimoa-shadow-connection-action);
}
.am-4380-6 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-surface-card); }
.am-4381-7 {
  height: 106.871rpx;
  border-radius: 53.436rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 19.084rpx;
}
.am-4381-8 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-connection-audio); }
</style>
