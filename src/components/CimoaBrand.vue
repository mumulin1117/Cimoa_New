<template>
  <view class="brand">
    <svg class="brand-arc" viewBox="0 0 58 16" fill="none" aria-hidden="true"><defs><linearGradient id="cimoa-home-arc" x1="0" y1="0" x2="58" y2="0" gradientUnits="userSpaceOnUse"><stop class="arc-start" /><stop class="arc-mid" offset="0.5" /><stop class="arc-end" offset="1" /></linearGradient></defs><path d="M3 14C3 7 11.5 2 29 2s26 5 26 12" stroke="url(#cimoa-home-arc)" stroke-width="4" stroke-linecap="round" /></svg>
    <text class="brand-name">Cimoa</text>
    <text class="brand-tagline">Real people. A rounder you.</text>
  </view>
</template>
<style scoped>
.brand { display: flex; flex-direction: column; align-items: center; gap: 3.817rpx; padding-top: 3.817rpx; }
.brand-arc { width: 110.687rpx; height: 30.534rpx; flex: none; }
.arc-start { stop-color: var(--cimoa-brand-cyan); }
.arc-mid { stop-color: var(--cimoa-brand-arc-mid); }
.arc-end { stop-color: var(--cimoa-brand-pink); }
.brand-name { font-size: 40.076rpx; font-weight: 500; letter-spacing: .30em; padding-left: .30em; }
.brand-tagline { font-size: 26.718rpx; color: var(--cimoa-text-tagline); letter-spacing: -.01em; white-space: nowrap; }
</style>
