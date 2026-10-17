<script setup>
import {computed} from 'vue'
import EventConfirmDialog from './EventConfirmDialog.vue'
import UserAvatar from './UserAvatar.vue'
const props=defineProps({open:Boolean,busy:Boolean,context:Object}),emit=defineEmits(['action'])
const c=computed(()=>props.context||{}),busy=computed(()=>props.busy)
const action=(name,event,row)=>{if(!busy.value)emit('action',({getCoins2:'getCoins',freeAlt:'standardMatch'})[name]||name,event,row)}
</script>
<template><view class="match-source-sheet"><EventConfirmDialog :open="open" :busy="busy" label="Auto Match / Help / Explanation" close-interaction="sheetAmHelp.closeSheet.click.1" @close="action('closeSheet')"><view data-source-line="4419" class="am-4419-1">How Auto Match works</view><view data-source-line="4420" class="am-4420-2">Your saved preferences help us find a compatible student. You can pause or leave the pool anytime. Chat unlocks only when you both accept.</view><view data-source-line="4421" class="am-4421-3" data-interaction="sheetAmHelp.closeSheet.click.2" @click="action('closeSheet',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('closeSheet',$event)"><view data-source-line="4421" class="am-4421-4">Got it</view></view></EventConfirmDialog></view></template>
<style scoped>
.match-source-sheet { --event-dialog-bottom: 0px; line-height: normal; -webkit-font-smoothing: antialiased; }
.match-source-sheet :deep(.event-dialog-panel) { padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.am-4419-1 { font-size: 45.801rpx; font-weight: 800; letter-spacing: -0.03em; }
.am-4420-2 { font-size: 30.534rpx; color: var(--cimoa-text-secondary); margin-top: 19.084rpx; line-height: 1.5; text-wrap: pretty; }
.am-4421-3 {
  height: 110.688rpx;
  border-radius: 55.344rpx;
  background: var(--cimoa-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 38.168rpx;
}
.am-4421-4 { font-size: 34.351rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
</style>
