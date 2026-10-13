<template>
  <view class="main-skeleton" role="status" aria-label="Loading connections">
    <view v-for="row in 3" :key="row" class="skeleton-card"><view class="skeleton-avatar" /><view class="skeleton-lines"><view /><view /></view></view>
  </view>
</template>
<style scoped>
.main-skeleton { padding: 41.985rpx 38.168rpx; }
.skeleton-card {
  display: flex;
  align-items: center;
  gap: 26.718rpx;
  margin-bottom: 26.718rpx;
  padding: 30.534rpx;
  border-radius: 49.618rpx;
  background: var(--cimoa-surface-card);
}
.skeleton-avatar { width: 148.855rpx; height: 148.855rpx; border-radius: 50%; background: var(--cimoa-surface-skeleton); }
.skeleton-lines { flex: 1; }
.skeleton-lines view { height: 38.168rpx; margin: 19.084rpx 0; border-radius: 19.084rpx; background: var(--cimoa-surface-skeleton); }
.skeleton-lines view:last-child { width: 75%; }
</style>
