<script setup>
import {computed} from 'vue'
import EventConfirmDialog from './EventConfirmDialog.vue'
import UserAvatar from './UserAvatar.vue'
const props=defineProps({open:Boolean,busy:Boolean,context:Object,cancel:Boolean}),emit=defineEmits(['action'])
const c=computed(()=>({...props.context,leave_copy:props.cancel?'Your invitation will be withdrawn. No connection will be made.':props.context?.leave_copy})),busy=computed(()=>props.busy)
const action=(name,event,row)=>{if(!busy.value)emit('action',props.cancel&&name==='passMatch'?'confirmCancel':name,event,row)}
</script>
<template><view class="match-source-sheet"><EventConfirmDialog :open="open" :busy="busy" :label="cancel ? 'Cancel this request?' : 'Auto Match / Found / Leave'" close-interaction="sheetAmFoundLeave.closeSheet.click.1" @close="action('closeSheet')"><view data-source-line="4431" class="am-4431-1">{{ cancel ? 'Cancel this request?' : 'Leave this match?' }}</view><view data-source-line="4432" class="am-4432-2">{{ c.leave_copy }}</view><view data-source-line="4433" class="am-4433-3" :data-interaction="cancel ? 'amWaiting.confirmCancel.click.1' : 'sheetAmFoundLeave.passMatch.click.1'" @click="action('passMatch',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('passMatch',$event)" :aria-label="cancel ? 'Cancel Request' : 'Skip match'"><view data-source-line="4433" class="am-4433-4">{{ cancel ? 'Cancel Request' : 'Leave match' }}</view></view><view data-source-line="4434" class="am-4434-5" data-interaction="sheetAmFoundLeave.closeSheet.click.2" @click="action('closeSheet',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('closeSheet',$event)"><view data-source-line="4434" class="am-4434-6">Stay</view></view></EventConfirmDialog></view></template>
<style scoped>
.match-source-sheet { --event-dialog-bottom: 0px; line-height: normal; -webkit-font-smoothing: antialiased; }
.match-source-sheet :deep(.event-dialog-panel) { padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.am-4431-1 { font-size: 45.801rpx; font-weight: 800; letter-spacing: -0.03em; }
.am-4432-2 { font-size: 30.534rpx; color: var(--cimoa-text-secondary); margin-top: 15.268rpx; line-height: 1.5; }
.am-4433-3 {
  height: 110.688rpx;
  border-radius: 55.344rpx;
  background: var(--cimoa-surface-card);
  border: 1.5px solid var(--cimoa-surface-connection-wave);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 38.168rpx;
}
.am-4433-4 { font-size: 34.351rpx; font-weight: 700; color: var(--cimoa-text-settings-danger); }
.am-4434-5 { height: 99.237rpx; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.am-4434-6 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-connection-audio); }
</style>
