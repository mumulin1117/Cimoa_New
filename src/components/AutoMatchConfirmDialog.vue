<script setup>
import {computed} from 'vue'
import EventConfirmDialog from './EventConfirmDialog.vue'
const props=defineProps({modal:String,context:Object,busy:Boolean})
const emit=defineEmits(['action'])
const standard=computed(()=>props.modal==='insufficient-standard')
const cost=computed(()=>standard.value?10:20)
const act=name=>{if(!props.busy)emit('action',name)}
</script>
<template>
  <view class="match-confirm">
    <EventConfirmDialog :open="modal === 'insufficient' || standard" :busy="busy" label="Not enough coins" close-interaction="sheetInsufficient.closeSheet.click.1" @close="act('closeSheet')">
      <view class="match-sheet-title">Not enough coins</view>
      <view class="match-sheet-copy">{{ standard ? 'Standard Match' : 'Priority Match' }} · {{ Math.max(0,cost - Number(context.balance_text?.split(' ')[0] || 0)) }} coins missing</view>
      <view class="match-sheet-rows"><view><view>Required</view><view>{{ cost }} coins</view></view><view><view>Current balance</view><view>{{ context.balance_text }}</view></view></view>
      <view class="match-sheet-primary" role="button" :aria-disabled="busy" data-interaction="sheetInsufficient.getCoins2.click.1" @click="act('getCoins')">Get Coins</view>
      <view class="match-sheet-secondary match-sheet-tinted" role="button" :aria-disabled="busy" data-interaction="sheetInsufficient.freeAlt.click.1" @click="act('standardMatch')">{{ standard ? 'Not Now' : 'Continue Standard Match' }}</view>
      <view class="match-sheet-cancel" role="button" :aria-disabled="busy" data-interaction="sheetInsufficient.closeSheet.click.2" @click="act('closeSheet')">Cancel</view>
    </EventConfirmDialog>
  </view>
</template>
<style scoped>
.match-confirm { -webkit-font-smoothing: antialiased; line-height: normal; --event-dialog-bottom: 0px; }
.match-confirm :deep(.event-dialog-panel) { padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.match-sheet-title { font-size: 47.709rpx; font-weight: 800; letter-spacing: -0.03em; }
.match-sheet-copy { margin-top: 11.45rpx; font-size: 30.534rpx; color: var(--cimoa-text-secondary); text-wrap: pretty; }
.match-sheet-rows { margin-top: 30.534rpx; }
.match-sheet-rows > view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 99.236rpx;
  border-bottom: 1px solid var(--cimoa-surface-event-divider);
  font-size: 32.442rpx;
}
.match-sheet-rows > view > view:first-child { color: var(--cimoa-text-secondary); }
.match-sheet-rows > view > view:last-child { font-weight: 700; }
.match-sheet-primary, .match-sheet-secondary, .match-sheet-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-align: center;
  font-size: 34.351rpx;
  font-weight: 600;
}
.match-sheet-primary {
  height: 114.503rpx;
  margin-top: 38.167rpx;
  border-radius: 57.251rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-auth-action);
  font-size: 36.259rpx;
  font-weight: 700;
}
.match-sheet-secondary { height: 106.87rpx; margin-top: 19.083rpx; border-radius: 53.435rpx; }
.match-sheet-tinted { background: var(--cimoa-surface-tinted); }
.match-sheet-cancel { height: 99.236rpx; color: var(--cimoa-text-connection-audio); }
</style>
