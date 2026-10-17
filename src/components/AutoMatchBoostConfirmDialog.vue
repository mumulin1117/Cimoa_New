<script setup>
import {computed} from 'vue'
import EventConfirmDialog from './EventConfirmDialog.vue'
import UserAvatar from './UserAvatar.vue'
const props=defineProps({open:Boolean,busy:Boolean,context:Object}),emit=defineEmits(['action'])
const c=computed(()=>props.context||{}),busy=computed(()=>props.busy)
const action=(name,event,row)=>{if(!busy.value)emit('action',({getCoins2:'getCoins',freeAlt:'standardMatch'})[name]||name,event,row)}
</script>
<template><view class="match-source-sheet"><EventConfirmDialog :open="open" :busy="busy" label="Auto Match / Boost / Confirmation" close-interaction="sheetBoost.closeSheet.click.1" @close="action('closeSheet')"><view data-source-line="4391" class="am-4391-1">Priority Match</view><view data-source-line="4392" class="am-4392-2">Priority Match moves you closer to the front of the queue for 15 minutes. It does not guarantee a match or connection.</view><view data-source-line="4393" class="am-4393-3"><view data-source-line="4394" class="am-4394-4"><view data-source-line="4395" class="am-4395-5">Cost</view><view data-source-line="4396" class="am-4396-6">{{ c.boost_cost }}</view></view><view data-source-line="4398" class="am-4398-7"><view data-source-line="4399" class="am-4399-8">Current balance</view><view data-source-line="4400" class="am-4400-9">{{ c.balance_text }}</view></view><view data-source-line="4402" class="am-4402-10"><view data-source-line="4403" class="am-4403-11">Balance after purchase</view><view data-source-line="4404" class="am-4404-12">{{ c.boost_after }}</view></view></view><view data-source-line="4407" class="am-4407-13" data-interaction="sheetBoost.confirmBoost.click.1" @click="action('confirmBoost',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('confirmBoost',$event)"><view data-source-line="4407" class="am-4407-14">Use 20 Coins</view></view><view data-source-line="4408" class="am-4408-15" data-interaction="sheetBoost.standardMatch.click.1" @click="action('standardMatch',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('standardMatch',$event)"><view data-source-line="4408" class="am-4408-16">Continue Standard Match</view></view><view data-source-line="4409" class="am-4409-17" data-interaction="sheetBoost.closeSheet.click.2" @click="action('closeSheet',$event)" role="button" tabindex="0" :aria-disabled="busy" @keydown.enter="action('closeSheet',$event)"><view data-source-line="4409" class="am-4409-18">Cancel</view></view></EventConfirmDialog></view></template>
<style scoped>
.match-source-sheet { --event-dialog-bottom: 0px; line-height: normal; -webkit-font-smoothing: antialiased; }
.match-source-sheet :deep(.event-dialog-panel) { padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.am-4391-1 { font-size: 47.709rpx; font-weight: 800; letter-spacing: -0.03em; }
.am-4392-2 { font-size: 30.534rpx; color: var(--cimoa-text-secondary); margin-top: 15.268rpx; text-wrap: pretty; }
.am-4393-3 { margin-top: 30.535rpx; }
.am-4394-4 { display: flex; align-items: center; justify-content: space-between; height: 99.237rpx; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.am-4395-5 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); }
.am-4396-6 { font-size: 32.442rpx; font-weight: 700; }
.am-4398-7 { display: flex; align-items: center; justify-content: space-between; height: 99.237rpx; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.am-4399-8 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); }
.am-4400-9 { font-size: 32.442rpx; font-weight: 700; }
.am-4402-10 { display: flex; align-items: center; justify-content: space-between; height: 99.237rpx; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.am-4403-11 { font-size: 32.442rpx; color: var(--cimoa-text-secondary); }
.am-4404-12 { font-size: 32.442rpx; font-weight: 700; }
.am-4407-13 {
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
.am-4407-14 { font-size: 36.259rpx; font-weight: 700; color: var(--cimoa-text-inverse); }
.am-4408-15 {
  height: 106.871rpx;
  border-radius: 53.436rpx;
  background: var(--cimoa-surface-tinted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: 19.084rpx;
}
.am-4408-16 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-title); }
.am-4409-17 { height: 99.237rpx; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.am-4409-18 { font-size: 34.351rpx; font-weight: 600; color: var(--cimoa-text-connection-audio); }
</style>
