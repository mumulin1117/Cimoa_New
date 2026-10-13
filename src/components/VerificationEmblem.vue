<template>
  <view class="verification-emblem" aria-hidden="true">
    <view class="verification-glow" />
    <svg class="verification-shield" viewBox="0 0 24 26" stroke-width=".5"><path d="M12 1 3 4.5v6.8C3 17.5 6.8 22 12 24c5.2-2 9-6.5 9-12.7V4.5z" /></svg>
    <svg class="verification-university" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18M5 10 12 5l7 5" /></svg>
    <svg class="verification-check" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="local-verification-gradient" x1="0" y1="0" x2="1" y2="1"><stop class="verification-stop-start" /><stop class="verification-stop-end" offset="1" /></linearGradient></defs><circle cx="12" cy="12" r="11" fill="url(#local-verification-gradient)" /><path d="m7.5 12.4 3 3 6-6.4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </view>
</template>
<style scoped>
.verification-emblem {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 229.008rpx;
  height: 229.008rpx;
}
.verification-glow { position: absolute; inset: 0; border-radius: 50%; background: var(--cimoa-gradient-verification-glow); filter: blur(11.45rpx); }
.verification-shield {
  position: relative;
  width: 164.122rpx;
  height: 179.389rpx;
  fill: var(--cimoa-surface-card);
  stroke: var(--cimoa-surface-verification-shield-border);
  filter: drop-shadow(var(--cimoa-shadow-verification-shield));
}
.verification-university { position: absolute; top: 72.519rpx; width: 57.252rpx; height: 57.252rpx; color: var(--cimoa-icon-primary); }
.verification-check { position: absolute; right: 26.718rpx; bottom: 30.534rpx; width: 49.618rpx; height: 49.618rpx; }
.verification-check path { stroke: var(--cimoa-text-inverse); }
.verification-stop-start { stop-color: var(--cimoa-brand-cyan); }
.verification-stop-end { stop-color: var(--cimoa-brand-purple); }
</style>
