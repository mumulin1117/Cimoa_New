<script setup>
import EventConfirmDialog from './EventConfirmDialog.vue'
defineProps({modal:String,context:Object,query:String,busy:Boolean})
defineEmits(['action'])
</script>
<template>
  <view class="match-picker">
    <EventConfirmDialog :open="modal === 'university' || modal === 'interests'" :busy="busy" :label="modal === 'university' ? 'University' : 'Interests'" :close-interaction="modal === 'university' ? 'sheetUniPicker.closeSheet.click.1' : 'sheetInterestsPicker.closeSheet.click.1'" @close="$emit('action','closeSheet')">
      <template #header>
        <view class="match-picker-heading"><view>{{ modal === 'university' ? 'University' : 'Interests' }}</view><view v-if="modal === 'interests'">{{ context.interest_count2 }}/5</view></view>
        <view v-if="modal === 'university'" class="match-picker-search"><view><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.2 16.2 21 21" /></svg></view><input :value="query" placeholder="Search for a university" data-interaction="sheetUniPicker.onUniSearch.change.1" @input="$emit('action','onUniSearch',$event)" /></view>
      </template>
      <view v-if="modal === 'university'" class="match-universities"><view v-for="o in context.uni_chips" :key="o.value" :style="{background:o.bg,color:o.ink}" role="button" tabindex="0" data-interaction="sheetUniPicker.o.pick.click.1" @click="$emit('action','pick',$event,o)" @keydown.enter="$emit('action','pick',$event,o)">{{ o.label }}</view><view v-if="!context.uni_chips?.length" class="match-picker-empty">No universities found.</view></view>
      <template v-else>
        <view class="match-interest-options"><view v-for="o in context.interest_picker_chips" :key="o.value" :style="{background:o.bg,color:o.ink,border:o.border}" role="button" tabindex="0" :aria-pressed="context.selected_interest_chips?.some(i=>i.item_id===o.value)" data-interaction="sheetInterestsPicker.o.pick.click.1" @click="$emit('action','pick',$event,o)" @keydown.enter="$emit('action','pick',$event,o)">{{ o.emoji }} {{ o.label }}</view></view>
        <view class="match-picker-done" role="button" tabindex="0" data-interaction="sheetInterestsPicker.closeSheet.click.2" @click="$emit('action','closeSheet')" @keydown.enter="$emit('action','closeSheet')">Done</view>
      </template>
    </EventConfirmDialog>
  </view>
</template>
<style scoped>
.match-picker { --event-dialog-bottom: 0px; -webkit-font-smoothing: antialiased; line-height: normal; }
.match-picker :deep(.event-dialog-panel) { height: calc(100vh - var(--app-safe-top) - 183.206rpx); max-height: calc(100vh - var(--app-safe-top) - 183.206rpx); padding-bottom: calc(64.885rpx + var(--app-safe-bottom)); }
.match-picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  font-size: 45.801rpx;
  font-weight: 800;
  letter-spacing: -0.03em;
}
.match-picker-heading > view:last-child:not(:first-child) { font-size: 28.625rpx; font-weight: 400; color: var(--cimoa-text-connection-muted); letter-spacing: normal; }
.match-picker-search {
  display: flex;
  align-items: center;
  gap: 19.083rpx;
  flex: none;
  height: 95.419rpx;
  margin-top: 26.717rpx;
  padding: 0 30.534rpx;
  border-radius: 47.709rpx;
  background: var(--cimoa-surface-tinted);
}
.match-picker-search > view { width: 34.351rpx; height: 34.351rpx; color: var(--cimoa-text-connection-muted); }
.match-picker-search svg { display: block; width: 100%; height: 100%; }
.match-picker-search input {
  flex: 1;
  min-width: 0;
  font-family: inherit;
  font-size: 30.534rpx;
  color: var(--cimoa-text-title);
  padding: 0 3.817rpx;
}
.match-picker :deep(.event-dialog-scroll .uni-scroll-view) { height: 100%; max-height: 100%; }
.match-universities { display: flex; flex-direction: column; gap: 19.083rpx; margin-top: 19.083rpx; }
.match-universities > view {
  display: flex;
  align-items: center;
  flex: none;
  height: 99.236rpx;
  padding: 0 38.167rpx;
  border-radius: 49.618rpx;
  font-size: 32.442rpx;
  font-weight: 600;
  cursor: pointer;
}
.match-interest-options { display: flex; flex-wrap: wrap; gap: 19.083rpx; margin-top: 30.534rpx; }
.match-interest-options > view {
  display: flex;
  align-items: center;
  gap: 11.45rpx;
  height: 87.786rpx;
  padding: 0 30.534rpx;
  border-radius: 43.893rpx;
  font-size: 30.534rpx;
  font-weight: 600;
  cursor: pointer;
}
.match-picker-done {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 106.87rpx;
  margin-top: 38.167rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  font-size: 34.351rpx;
  font-weight: 700;
  cursor: pointer;
}
.match-picker-empty { color: var(--cimoa-text-secondary); }
</style>
