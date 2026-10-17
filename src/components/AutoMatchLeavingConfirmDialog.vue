<script setup>
import {computed} from 'vue'
import EventConfirmDialog from './EventConfirmDialog.vue'
import UserAvatar from './UserAvatar.vue'
const props=defineProps({open:Boolean,busy:Boolean,context:Object}),emit=defineEmits(['action'])
const c=computed(()=>props.context||{}),busy=computed(()=>props.busy)
const action=(name,event,row)=>{if(!busy.value)emit('action',({getCoins2:'getCoins',freeAlt:'standardMatch'})[name]||name,event,row)}
</script>
<template><view class="match-source-sheet"><EventConfirmDialog :open="open" :busy="busy" label="Auto Match / Queue / Leaving" close-interaction="sheetLeaving.closeSheet.click.1" @close="action('closeSheet')"><view data-source-line="4362" class="am-4362-1">Leave the matching pool?</view><view data-source-line="4363" class="am-4363-2">You can join again whenever you’re ready. Your preferences are kept.</view><view data-source-line="4364" class="am-4364-3" data-interaction="sheetLeaving.stayInPool.click.1" @click="action('stayInPool',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('stayInPool',$event)"><view data-source-line="4364" class="am-4364-4">Stay in Pool</view></view><view data-source-line="4365" class="am-4365-5" data-interaction="sheetLeaving.confirmLeave.click.1" @click="action('confirmLeave',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('confirmLeave',$event)"><view data-source-line="4365" class="am-4365-6">Leave Pool</view></view></EventConfirmDialog></view></template>
<style scoped>
.match-source-sheet { --event-dialog-bottom: 0px; line-height: normal; -webkit-font-smoothing: antialiased; }
.match-source-sheet :deep(.event-dialog-panel) { padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.am-4362-1 { font-size: 47.709rpx; font-weight: 800; letter-spacing: -0.03em; }
.am-4363-2 { font-size: 30.534rpx; color: var(--cimoa-text-secondary); margin-top: 15.268rpx; text-wrap: pretty; }
.am-4364-3 {
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
.am-4364-4 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-4365-5 {
  height: 106.871rpx;
  border-radius: 53.436rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 19.084rpx;
}
.am-4365-6 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-connection-audio); }
</style>
