<script setup>
import { computed } from 'vue'
import { MOTION } from '@/config/navigation.js'
const props = defineProps({ kind: { type: String, default: 'home' } })
const label = computed(() => ({ home: 'Loading your connections', discover: 'Loading people', events: 'Loading campus events', profile: 'Loading profile', event: 'Loading event details' })[props.kind])
const motion_style = {
  '--skeleton-reveal': `${MOTION.skeleton_reveal}ms`,
  '--skeleton-stagger': `${MOTION.skeleton_stagger}ms`,
}
const reveal_delay = index => ({ '--skeleton-delay': `${index * MOTION.skeleton_stagger}ms` })
</script>

<template>
  <view class="content-skeleton" :class="`content-skeleton--${kind}`" :style="motion_style" role="status" :aria-label="label" aria-busy="true" :data-skeleton="kind">
    <view aria-hidden="true" class="skeleton-layout">
      <template v-if="kind === 'home'">
        <view v-for="row in 3" :key="row" class="skeleton-card skeleton-contact" :style="reveal_delay(row - 1)">
          <view class="skeleton-avatar-stage">
            <view class="skeleton-block skeleton-avatar" />
            <view class="skeleton-meet-track"><view class="skeleton-meet-dot skeleton-meet-dot--cyan" /><view class="skeleton-meet-dot skeleton-meet-dot--pink" /></view>
          </view>
          <view class="skeleton-lines"><view class="skeleton-block skeleton-line skeleton-line--name" /><view class="skeleton-block skeleton-line" /><view class="skeleton-block skeleton-line skeleton-line--short" /></view>
        </view>
      </template>
      <template v-else-if="kind === 'discover'">
        <view class="skeleton-deck"><view class="skeleton-block skeleton-deck-back" /><view class="skeleton-block skeleton-deck-photo"><view class="skeleton-photo-copy"><view class="skeleton-block skeleton-line skeleton-line--name" /><view class="skeleton-block skeleton-line" /><view class="skeleton-chip-row"><view v-for="chip in 3" :key="chip" class="skeleton-block skeleton-chip" /></view></view></view></view>
      </template>
      <template v-else-if="kind === 'events'">
        <view v-for="row in 2" :key="row" class="skeleton-card skeleton-event-card" :style="reveal_delay(row - 1)">
          <view class="skeleton-block skeleton-event-photo" />
          <view class="skeleton-event-copy">
            <view class="skeleton-block skeleton-line skeleton-line--name" />
            <view v-for="node in 2" :key="node" class="skeleton-event-node"><view class="skeleton-event-dot" /><view class="skeleton-block skeleton-line" :class="{ 'skeleton-line--short': node === 2 }" /></view>
          </view>
        </view>
      </template>
      <template v-else>
        <view class="skeleton-block skeleton-entity-photo" />
        <view class="skeleton-card skeleton-entity-copy"><view class="skeleton-chip-row"><view v-for="chip in 3" :key="chip" class="skeleton-block skeleton-chip" /></view><view class="skeleton-block skeleton-line skeleton-line--name" /><view class="skeleton-block skeleton-line" /><view class="skeleton-block skeleton-line skeleton-line--short" /></view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.content-skeleton { padding: 41.985rpx 38.168rpx 38.168rpx; overflow: hidden; pointer-events: none; }
.skeleton-card { position: relative; overflow: hidden; border-radius: 49.618rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-loading-shell); animation: skeleton-shell-arrive var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; animation-delay: var(--skeleton-delay, 0ms); }
.skeleton-block { position: relative; overflow: hidden; background: var(--cimoa-gradient-loading-block); }
.skeleton-card::after, .skeleton-deck-photo::after, .skeleton-entity-photo::after {
  content: '';
  position: absolute;
  inset: -22% auto -22% -68%;
  width: 54%;
  background: var(--cimoa-gradient-loading-reveal);
  opacity: 0;
  transform: skewX(-14deg);
  pointer-events: none;
  animation: skeleton-reveal-pass var(--skeleton-reveal) ease-out both;
  animation-delay: var(--skeleton-delay, 0ms);
}
.skeleton-contact { display: flex; align-items: center; gap: 26.718rpx; padding: 30.534rpx; margin-bottom: 26.718rpx; }
.skeleton-avatar-stage { position: relative; flex: none; width: 148.855rpx; height: 148.855rpx; }
.skeleton-avatar { position: absolute; inset: 0; border-radius: 50%; }
.skeleton-meet-track { position: absolute; inset: -9.542rpx; border-radius: 50%; opacity: 0; animation: skeleton-track-arrive var(--skeleton-reveal) ease-out both; animation-delay: var(--skeleton-delay, 0ms); }
.skeleton-meet-track::before { content: ''; position: absolute; inset: 0; padding: 2.863rpx; border-radius: inherit; background: var(--cimoa-gradient-loading-home-orbit); -webkit-mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill); -webkit-mask-composite: xor; mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill); mask-composite: exclude; }
.skeleton-meet-dot { position: absolute; top: 50%; left: 50%; width: 13.359rpx; height: 13.359rpx; margin: -6.679rpx 0 0 -6.679rpx; border-radius: 50%; }
.skeleton-meet-dot--cyan { background: var(--cimoa-brand-cyan); box-shadow: var(--cimoa-shadow-connection-cyan); animation: skeleton-meet-cyan var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; animation-delay: var(--skeleton-delay, 0ms); }
.skeleton-meet-dot--pink { background: var(--cimoa-brand-pink); box-shadow: var(--cimoa-shadow-connection-pink); animation: skeleton-meet-pink var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; animation-delay: var(--skeleton-delay, 0ms); }
.skeleton-lines { flex: 1; min-width: 0; }
.skeleton-line { height: 26.718rpx; margin-top: 19.084rpx; border-radius: 13.359rpx; transform-origin: left center; animation: skeleton-line-reveal var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; animation-delay: calc(var(--skeleton-delay, 0ms) + var(--skeleton-stagger)); }
.skeleton-line--name { width: 72%; height: 38.168rpx; margin-top: 0; }
.skeleton-line--short { width: 52%; }
.skeleton-chip-row { display: flex; gap: 15.267rpx; }
.skeleton-chip { flex: 1; height: 64.885rpx; border-radius: 32.443rpx; animation: skeleton-chip-reveal var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; animation-delay: var(--skeleton-stagger); }
.content-skeleton--discover { height: 100%; padding-top: 22.901rpx; padding-bottom: 15.267rpx; }
.content-skeleton--discover .skeleton-layout { height: 100%; }
.skeleton-deck { position: relative; height: 100%; max-height: 1034.351rpx; padding: 13.359rpx 7.634rpx 0; }
.skeleton-deck-back { position: absolute; inset: 0 15.267rpx 19.084rpx; border-radius: 49.618rpx; background: var(--cimoa-gradient-loading-block); transform: rotate(2deg); animation: skeleton-deck-fan var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; }
.skeleton-deck-photo { height: 100%; border-radius: 49.618rpx; background: var(--cimoa-gradient-loading-discover-mist); animation: skeleton-mist-arrive var(--skeleton-reveal) ease-out both; }
.skeleton-photo-copy {
  position: absolute;
  left: 30.534rpx;
  right: 30.534rpx;
  bottom: 34.351rpx;
  padding: 26.718rpx;
  border-radius: 30.534rpx;
  background: var(--cimoa-surface-empty);
}
.skeleton-photo-copy .skeleton-chip-row { margin-top: 26.718rpx; }
.skeleton-event-card { margin-bottom: 30.534rpx; }
.skeleton-event-photo { height: 343.511rpx; background: var(--cimoa-gradient-loading-event-mist); animation: skeleton-mist-arrive var(--skeleton-reveal) ease-out both; animation-delay: var(--skeleton-delay, 0ms); }
.skeleton-event-copy { padding: 30.534rpx; }
.skeleton-event-node { display: flex; align-items: center; gap: 17.176rpx; margin-top: 19.084rpx; }
.skeleton-event-node .skeleton-line { flex: 1; width: auto; margin-top: 0; }
.skeleton-event-node .skeleton-line--short { flex: 0 0 52%; }
.skeleton-event-dot { flex: none; width: 19.084rpx; height: 19.084rpx; border-radius: 50%; background: var(--cimoa-gradient-event-timeline); animation: skeleton-node-reveal var(--skeleton-reveal) cubic-bezier(.2,.8,.25,1) both; animation-delay: calc(var(--skeleton-delay, 0ms) + var(--skeleton-stagger)); }
.content-skeleton--profile { padding-top: 22.901rpx; }
.skeleton-entity-photo { aspect-ratio: 3 / 4; border-radius: 45.802rpx; background: var(--cimoa-gradient-loading-discover-mist); animation: skeleton-mist-arrive var(--skeleton-reveal) ease-out both; }
.skeleton-entity-copy { padding: 34.351rpx; margin-top: 38.168rpx; }
.skeleton-entity-copy .skeleton-chip-row { margin-bottom: 34.351rpx; }
.content-skeleton--event { padding: 0; }
.content-skeleton--event .skeleton-entity-photo { height: var(--event-detail-cover-height); aspect-ratio: auto; border-radius: 0; background: var(--cimoa-gradient-loading-event-mist); }
.content-skeleton--event .skeleton-entity-copy { margin: 30.534rpx 38.168rpx; }
@keyframes skeleton-shell-arrive { from { opacity: .5; transform: translateY(11.45rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes skeleton-line-reveal { from { opacity: .35; transform: scaleX(.62); } to { opacity: 1; transform: scaleX(1); } }
@keyframes skeleton-chip-reveal { from { opacity: .35; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
@keyframes skeleton-node-reveal { from { opacity: 0; transform: scale(.45); } 58% { opacity: 1; transform: scale(1.16); } to { opacity: 1; transform: scale(1); } }
@keyframes skeleton-track-arrive { from { opacity: 0; transform: scale(.78) rotate(-12deg); } to { opacity: .72; transform: scale(1) rotate(0); } }
@keyframes skeleton-meet-cyan { from { opacity: .25; transform: translateX(-49.618rpx) scale(.7); } 62% { opacity: 1; transform: translateX(-5.725rpx) scale(1.15); } to { opacity: .8; transform: translateX(-5.725rpx) scale(1); } }
@keyframes skeleton-meet-pink { from { opacity: .25; transform: translateX(49.618rpx) scale(.7); } 62% { opacity: 1; transform: translateX(5.725rpx) scale(1.15); } to { opacity: .8; transform: translateX(5.725rpx) scale(1); } }
@keyframes skeleton-reveal-pass { from { opacity: 0; transform: translateX(0) skewX(-14deg); } 24% { opacity: 1; } to { opacity: 0; transform: translateX(315%) skewX(-14deg); } }
@keyframes skeleton-deck-fan { from { opacity: .45; transform: rotate(0) scale(.97); } to { opacity: 1; transform: rotate(2deg) scale(1); } }
@keyframes skeleton-mist-arrive { from { opacity: .55; background-position: 18% 12%; transform: scale(1.035); } to { opacity: 1; background-position: 50% 50%; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .skeleton-card, .skeleton-card::after, .skeleton-deck-photo, .skeleton-deck-photo::after, .skeleton-deck-back, .skeleton-entity-photo, .skeleton-entity-photo::after, .skeleton-line, .skeleton-chip, .skeleton-event-dot, .skeleton-meet-track, .skeleton-meet-dot { animation: none; transform: none; }
  .skeleton-card::after, .skeleton-deck-photo::after, .skeleton-entity-photo::after { display: none; }
  .skeleton-meet-track { opacity: .45; }
  .skeleton-meet-dot--cyan { transform: translateX(-5.725rpx); opacity: .72; }
  .skeleton-meet-dot--pink { transform: translateX(5.725rpx); opacity: .72; }
}
</style>
