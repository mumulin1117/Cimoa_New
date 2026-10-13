<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { MAIN_TABS } from '@/config/navigation.js'
import { current_route, switch_tab_route } from '@/utils/routeTransition.js'
import SourceIcon from './SourceIcon.vue'

const active = ref(current_route()), busy = ref(false), error = ref('')
onShow(() => { active.value = current_route() })
const go_tab = async (tab) => {
  if (busy.value || current_route() === tab.path) return
  busy.value = true; error.value = ''
  try { await switch_tab_route(`/${tab.path}`) } catch (cause) { error.value = cause.message } finally { busy.value = false; active.value = current_route() }
}
</script>

<template>
  <view class="tabbar-area">
    <text v-if="error" class="tabbar-error" role="alert">{{ error }}</text>
    <view class="tabbar" role="navigation" aria-label="Primary navigation">
      <view v-for="tab in MAIN_TABS" :key="tab.id" class="tab" :class="{ active: active === tab.path }" role="button" :aria-label="tab.label" :aria-current="active === tab.path ? 'page' : undefined" :aria-disabled="busy" @click="go_tab(tab)">
        <view class="tab__circle"><view class="tab__icon"><SourceIcon :name="tab.icon" /></view></view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.tabbar-area { position: relative; z-index: 20; flex: none; height: var(--app-main-tab-bar-height); padding: 22.901rpx 38.168rpx calc(53.435rpx + var(--app-safe-bottom)); }
.tabbar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: 118.321rpx;
  border-radius: 59.16rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-tab);
}
.tab { display: flex; justify-content: center; align-items: center; color: var(--cimoa-text-title); }
.tab__circle {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 99.237rpx;
  height: 99.237rpx;
  border-radius: 50%;
}
.tab.active .tab__circle { background: var(--cimoa-gradient-tab); color: var(--cimoa-text-inverse); }
.tab__icon { width: 49.618rpx; height: 49.618rpx; }
.tabbar-error { position: absolute; bottom: 100%; left: 38.168rpx; right: 38.168rpx; color: var(--cimoa-status-danger); }
</style>
