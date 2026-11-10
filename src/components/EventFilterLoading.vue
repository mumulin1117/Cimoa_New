<script setup>
import { ref, watch } from 'vue'
import { MOTION } from '@/config/navigation.js'
import BrandRefresh from './BrandRefresh.vue'
const props = defineProps({ visible: Boolean, category: { type: String, default: '' } })
const displayed_category = ref(props.category)
// Preserve this visual caption during the short exit, not a second filter value.
watch(() => props.category, category => { if (category) displayed_category.value = category })
</script>

<template>
  <view class="event-filter-anchor">
  <Transition name="event-filter">
    <view v-show="visible" class="event-filter-loading" :aria-hidden="!visible" :data-category="displayed_category" :style="{ '--event-filter-enter': `${MOTION.event_filter_enter}ms`, '--event-filter-leave': `${MOTION.event_filter_leave}ms` }">
      <view class="event-filter-surface">
        <view class="event-filter-glass">
          <BrandRefresh :refreshing="visible" :progress="1" :label="`Updating events: ${displayed_category}`">
            <template #copy><view class="event-filter-copy"><text class="event-filter-title">Updating events</text><text class="event-filter-category">{{ displayed_category }}</text></view></template>
          </BrandRefresh>
        </view>
      </view>
    </view>
  </Transition>
  </view>
</template>

<style scoped>
.event-filter-anchor {
  position: sticky;
  z-index: 4;
  top: 22.901rpx;
  margin: 0 38.168rpx;
  height: 0;
  pointer-events: none;
}
.event-filter-loading {
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.event-filter-surface {
  max-width: 100%;
  padding: 1.908rpx;
  border-radius: 41.985rpx;
  background: var(--cimoa-gradient-event-filter-border);
  box-shadow: var(--cimoa-shadow-event-filter);
  backdrop-filter: blur(26.718rpx);
  -webkit-backdrop-filter: blur(26.718rpx);
}
.event-filter-glass { padding: 0 30.534rpx 0 15.267rpx; border-radius: 40.076rpx; background: var(--cimoa-surface-event-filter-glass); }
.event-filter-copy { display: flex; flex-direction: column; gap: 3.817rpx; min-width: 213.74rpx; padding-right: 7.634rpx; }
.event-filter-title { color: var(--cimoa-text-title); font-size: 28.626rpx; font-weight: 600; line-height: 1.35; }
.event-filter-category { color: var(--cimoa-text-secondary); font-size: 22.901rpx; font-weight: 500; line-height: 1.35; }
.event-filter-loading :deep(.refresh-composition) { gap: 7.634rpx; }
.event-filter-enter-active { transition: opacity var(--event-filter-enter) ease, transform var(--event-filter-enter) cubic-bezier(.2,.8,.25,1); }
.event-filter-leave-active { transition: opacity var(--event-filter-leave) ease, transform var(--event-filter-leave) ease; }
.event-filter-enter-from, .event-filter-leave-to { opacity: 0; transform: translateY(-11.45rpx) scale(.97); }
@media (prefers-reduced-motion: reduce) { .event-filter-enter-active, .event-filter-leave-active { transition: none; } }
</style>
