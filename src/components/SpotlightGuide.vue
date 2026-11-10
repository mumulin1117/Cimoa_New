<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { MOTION } from '@/config/navigation.js'
import { auto_match_guide_layout, auto_match_guide_scrim_path } from '@/utils/autoMatchGuideLayout.js'
import SourceIcon from './SourceIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  step: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' },
  steps: { type: Array, required: true },
  targets: { type: Array, default: () => [] },
  scopeSelector: { type: String, default: '.main-tab-frame, .auto-match-index' },
  interactionPrefix: { type: String, default: 'autoMatchGuide' },
  kind: { type: String, default: 'auto-match' },
  nextDisabled: { type: Boolean, default: false },
  interactiveTarget: { type: Boolean, default: false },
})
const emit = defineEmits(['next', 'back', 'skip', 'relayout'])
const instance = getCurrentInstance(), card_node = ref(null)
const title_id = `spotlight-guide-title-${instance.uid}`, copy_id = `spotlight-guide-copy-${instance.uid}`, gradient_id = `spotlight-guide-gradient-${instance.uid}`
const rendered = ref(false), showing = ref(false), layout_ready = ref(false), interaction_ready = ref(false), retained_step = ref(0)
const geometry = ref(null), natural_body_height = ref(0)
const current = computed(() => props.steps[retained_step.value] || {})
const final_step = computed(() => retained_step.value === props.steps.length - 1)
const unavailable = computed(() => props.busy || !props.open || !showing.value || !layout_ready.value || !interaction_ready.value)
const can_interact_target = computed(() => props.interactiveTarget && !!geometry.value?.spot && !unavailable.value)
const interaction_id = action => `${props.interactionPrefix}.${action}.click.1`
const motion_style = { '--guide-enter': `${MOTION.page}ms`, '--guide-leave': `${MOTION.back}ms`, '--guide-detail': `${MOTION.popover}ms` }
let generation = 0, leave_timer = null, first_frame = null, second_frame = null, resize_frame = null, previous_focus = null, disposed = false

const native_node = () => card_node.value?.$el || card_node.value
const to_style = rect => {
  const scale = geometry.value?.rpx_scale || 750 / (uni.getWindowInfo().windowWidth || 393)
  return Object.fromEntries(['left', 'top', 'width', 'height'].filter(key => Number.isFinite(rect?.[key])).map(key => [key, `${rect[key] * scale}rpx`]))
}
const card_style = computed(() => geometry.value ? to_style(geometry.value.card) : { left: '38.168rpx', top: '0', width: '673.664rpx' })
const body_style = computed(() => ({ height: `${(geometry.value?.body_height || natural_body_height.value || 190) * (geometry.value?.rpx_scale || 750 / (uni.getWindowInfo().windowWidth || 393))}rpx` }))
const scrim_path = computed(() => auto_match_guide_scrim_path(geometry.value))
const scrim_viewbox = computed(() => geometry.value ? `0 0 ${geometry.value.viewport.width} ${geometry.value.viewport.height}` : '0 0 1 1')
const visible_control = (node, include_disabled = false) => (include_disabled || node.getAttribute('aria-disabled') !== 'true') && !node.closest?.('[inert]') && node.isConnected && node.getBoundingClientRect().height > 0
const controls = (include_disabled = false) => {
  const card_controls = Array.from(native_node()?.querySelectorAll?.('[role="button"][tabindex="0"]') || [])
  const target_controls = can_interact_target.value ? Array.from(target_node()?.querySelectorAll?.('[role="button"][tabindex="0"]') || []) : []
  return [...target_controls, ...card_controls].filter(node => visible_control(node, include_disabled))
}
const focus_primary = (include_disabled = false) => {
  if (!props.open || !showing.value || typeof document === 'undefined') return
  const all = controls(include_disabled), target = all[all.length - 1] || native_node()
  target?.focus?.({ preventScroll: true })
}
const owns_presentation = token => !disposed && token === generation && props.open && showing.value && layout_ready.value && globalThis.document?.visibilityState !== 'hidden'
const settle_interaction = async (token, focus) => {
  await nextTick()
  if (!owns_presentation(token)) return
  const node = native_node()
  let animations = []
  // Layout owns the measured bounds; the existing CSS transition owns their
  // arrival. Do not advertise a moving touch target as ready or add a second
  // timed wait. Reduced motion still waits for its existing fade to be visible;
  // it never enables a barely visible control before the same arrival settles.
  try { animations = (node?.getAnimations?.({ subtree: false }) || []).filter(animation => animation.playState === 'running' || animation.pending) } catch { /* Hosts without animation introspection remain usable. */ }
  if (animations.length) await Promise.allSettled(animations.map(animation => animation.finished))
  if (!owns_presentation(token)) return
  if (focus) focus_primary(true)
  // Focus is installed before enabled is published, never after a new touch.
  await nextTick()
  if (owns_presentation(token)) interaction_ready.value = true
}
const cancel_frames = () => {
  if (typeof cancelAnimationFrame === 'function') [first_frame, second_frame, resize_frame].forEach(frame => { if (frame !== null) cancelAnimationFrame(frame) })
  first_frame = null; second_frame = null; resize_frame = null
  if (leave_timer !== null) clearTimeout(leave_timer)
  leave_timer = null
}
const release_focus = () => {
  const target = previous_focus; previous_focus = null
  if (!target?.isConnected || typeof document === 'undefined' || document.visibilityState === 'hidden' || target.closest?.('[inert], [aria-hidden="true"]')) return
  if (typeof target.checkVisibility === 'function' && !target.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return
  // A retained source may still be connected in a Teleport underlay. Closing
  // this page's guide must never steal focus back into another real page.
  const owner = native_node()?.closest?.(props.scopeSelector) || native_node()?.closest?.('uni-page')
  if (owner && target !== document.body && !owner.contains?.(target)) return
  target.focus?.({ preventScroll: true })
}
const target_node = () => {
  if (typeof document === 'undefined') return null
  const selector = props.targets[retained_step.value]
  if (!selector) return null
  // Query only the actual page that owns this controlled instance. uni-app
  // retains earlier pages; their targets must never own a foreground spotlight.
  const page = native_node()?.closest?.(props.scopeSelector) || native_node()?.closest?.('uni-page')
  if (!page) return null
  const candidates = Array.from(page.querySelectorAll(selector))
  return candidates.map(node => {
    const rect = node.getBoundingClientRect(), style = window.getComputedStyle(node)
    const visible = typeof node.checkVisibility !== 'function' || node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    return visible && style.display !== 'none' && style.visibility !== 'hidden' && node.isConnected && rect.width > 0 && rect.height > 0 ? node : null
  }).find(Boolean) || null
}
const measure_target = () => target_node()?.getBoundingClientRect() || null
const measure = async token => {
  await nextTick()
  if (disposed || token !== generation || !props.open) return
  const query = uni.createSelectorQuery().in(instance)
  query.select('.guide-card').boundingClientRect()
  query.select('.guide-body').boundingClientRect()
  query.select('.guide-copy').boundingClientRect()
  query.select('.guide-safe-top').boundingClientRect()
  query.select('.guide-safe-bottom').boundingClientRect()
  query.exec(result => {
    if (disposed || token !== generation || !props.open) return
    const [card, body, copy, safe_top, safe_bottom] = result || []
    if (!card || !body || !copy) return
    const info = uni.getWindowInfo(), width = info.windowWidth, height = info.windowHeight
    const chrome_height = Math.max(0, card.height - body.height)
    natural_body_height.value = copy.height
    geometry.value = auto_match_guide_layout({ width, height, safe_top: safe_top?.height || 0, safe_bottom: safe_bottom?.height || 0, anchor: measure_target(), card_height: chrome_height + copy.height, chrome_height, interactive_target: props.interactiveTarget })
    layout_ready.value = true
    if (showing.value) {
      // Resize/error changes only relayout the stable card. They do not replay
      // cRise, reset focus, or insert the opening paint-frame sequence.
      settle_interaction(token, false)
    } else if (typeof requestAnimationFrame === 'function') {
      // Two distinct paint frames preserve cRise on first and warm opens.
      first_frame = requestAnimationFrame(() => {
        first_frame = null
        second_frame = requestAnimationFrame(() => {
          second_frame = null
          if (token !== generation || !props.open || disposed) return
          showing.value = true; settle_interaction(token, true)
        })
      })
    } else { showing.value = true; settle_interaction(token, true) }
    emit('relayout', { step: retained_step.value, anchored: !!geometry.value.spot, placement: geometry.value.placement })
  })
}
const begin = () => {
  const token = ++generation; cancel_frames()
  if (!rendered.value && typeof document !== 'undefined' && !previous_focus) previous_focus = document.activeElement
  retained_step.value = Math.max(0, Math.min(Math.max(0, props.steps.length - 1), Math.trunc(props.step) || 0))
  rendered.value = true; showing.value = false; layout_ready.value = false; interaction_ready.value = false
  measure(token)
}
const interrupt = () => {
  generation++; cancel_frames(); showing.value = false; rendered.value = false; layout_ready.value = false; interaction_ready.value = false
}
const remeasure = () => {
  if (!props.open || disposed) return
  const token = ++generation; cancel_frames()
  interaction_ready.value = false
  // A size change remeasures in place; no extra entry delay or business action.
  resize_frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => { resize_frame = null; measure(token) }) : null
  if (resize_frame === null) measure(token)
}
const request_action = action => { if (!unavailable.value && !(action === 'next' && props.nextDisabled)) emit(action) }
const keydown = event => {
  if (!props.open || !rendered.value) return
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); request_action('skip'); return }
  if (event.key !== 'Tab') return
  const all = controls()
  event.preventDefault()
  if (!all.length) { native_node()?.focus?.({ preventScroll: true }); return }
  const index = all.indexOf(document.activeElement), direction = event.shiftKey ? -1 : 1
  const next = index < 0 ? (event.shiftKey ? all.length - 1 : 0) : (index + direction + all.length) % all.length
  all[next].focus({ preventScroll: true })
}
const allowed_focus = node => native_node()?.contains?.(node) || can_interact_target.value && target_node()?.contains?.(node)
const focusin = event => { if (props.open && showing.value && !allowed_focus(event.target)) focus_primary() }
// Only the highlighted question/mode controls are live. Padding around a
// rounded hole must not accidentally expose a neighbouring business control.
const guard_target_input = event => {
  if (!props.open || !rendered.value || !props.interactiveTarget || native_node()?.contains?.(event.target)) return
  if (can_interact_target.value && target_node()?.contains?.(event.target)) return
  event.preventDefault(); event.stopImmediatePropagation()
}
const visibility_changed = () => { if (document.visibilityState === 'hidden') interrupt(); else if (props.open) begin() }
watch(() => [props.open, props.step], () => {
  if (props.open) { begin(); return }
  const token = ++generation; cancel_frames(); showing.value = false; interaction_ready.value = false
  if (!rendered.value) { release_focus(); return }
  leave_timer = setTimeout(() => {
    leave_timer = null
    if (token !== generation || props.open || disposed) return
    rendered.value = false; layout_ready.value = false; release_focus()
  }, MOTION.back)
}, { immediate: true })
watch(() => [props.error, props.steps, props.targets, props.scopeSelector], () => { if (props.open) remeasure() })
onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', focusin, true); document.addEventListener('visibilitychange', visibility_changed)
    document.addEventListener('pointerdown', guard_target_input, true); document.addEventListener('click', guard_target_input, true)
  }
  if (typeof window !== 'undefined') window.addEventListener('resize', remeasure)
})
onShow(() => { if (props.open && !rendered.value) begin() })
onHide(interrupt)
onUnmounted(() => {
  disposed = true; interrupt(); release_focus()
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin, true); document.removeEventListener('visibilitychange', visibility_changed)
    document.removeEventListener('pointerdown', guard_target_input, true); document.removeEventListener('click', guard_target_input, true)
  }
  if (typeof window !== 'undefined') window.removeEventListener('resize', remeasure)
})
defineExpose({ remeasure })
</script>

<template>
  <view v-show="rendered" class="spotlight-guide" :class="{ 'spotlight-guide--open': showing, 'spotlight-guide--ready': layout_ready, 'spotlight-guide--interactive': interactiveTarget, 'auto-match-guide': kind === 'auto-match', 'auto-match-guide--open': kind === 'auto-match' && showing, 'auto-match-guide--ready': kind === 'auto-match' && layout_ready, 'discover-guide': kind === 'discover' }" :data-guide-kind="kind" :data-guide-step="retained_step" :data-guide-ready="!unavailable" :data-guide-target-ready="can_interact_target" :style="motion_style" @click.stop>
    <view class="guide-safe-top" aria-hidden="true" /><view class="guide-safe-bottom" aria-hidden="true" />
    <svg v-if="geometry" class="guide-scrim" :viewBox="scrim_viewbox" preserveAspectRatio="none" aria-hidden="true"><path :d="scrim_path" fill-rule="evenodd" /></svg>
    <view v-if="geometry?.spot" class="guide-spotlight" :style="to_style(geometry.spot)" aria-hidden="true"><view class="guide-spotlight-line" /></view>
    <view ref="card_node" class="guide-card" :class="{ 'guide-card--final': final_step }" :style="card_style" role="dialog" :aria-modal="interactiveTarget ? undefined : 'true'" :aria-labelledby="title_id" :aria-describedby="copy_id" :aria-busy="busy" tabindex="-1" @click.stop>
      <view class="guide-card-head">
        <view class="guide-heading"><text class="guide-kicker">QUICK START</text><text class="guide-counter" :aria-label="`Step ${retained_step + 1} of ${steps.length}`">{{ retained_step + 1 }} <text class="guide-counter-separator">/ {{ steps.length }}</text></text></view>
        <view v-if="!interactiveTarget" class="guide-skip" role="button" tabindex="0" :aria-disabled="unavailable" :data-interaction="interaction_id('skip')" @click="request_action('skip')" @keydown.enter.stop.prevent="request_action('skip')" @keydown.space.stop.prevent="request_action('skip')">Skip</view>
      </view>
      <view class="guide-stage" aria-hidden="true">
        <view v-if="!final_step" class="guide-symbol"><SourceIcon :name="current.icon" /></view>
        <view v-else class="guide-encounter">
          <svg class="guide-encounter-arc" viewBox="0 0 210 72" fill="none"><defs><linearGradient :id="gradient_id"><stop class="guide-arc-cyan" /><stop offset="0.5" class="guide-arc-blue" /><stop offset="1" class="guide-arc-pink" /></linearGradient></defs><path d="M31 51C51 4 159 4 179 51" :stroke="`url(#${gradient_id})`" stroke-width="3" stroke-linecap="round" /></svg>
          <view class="guide-person guide-person--first"><SourceIcon name="person" /></view><view class="guide-person guide-person--second"><SourceIcon name="person" /></view>
        </view>
        <view class="guide-stage-glow" />
      </view>
      <scroll-view class="guide-body" :style="body_style" scroll-y :show-scrollbar="false">
        <view class="guide-copy" :key="retained_step">
          <text :id="title_id" class="guide-title">{{ current.title }}</text>
          <text :id="copy_id" class="guide-description">{{ current.description }}</text>
          <text v-if="error" class="guide-error" role="alert">{{ error }}</text>
        </view>
      </scroll-view>
      <view class="guide-card-footer">
        <view class="guide-progress" aria-hidden="true"><view v-for="index in steps.length" :key="index" class="guide-progress-dot" :class="{ 'guide-progress-dot--current': index === retained_step + 1, 'guide-progress-dot--past': index < retained_step + 1 }" /></view>
        <view class="guide-actions">
          <view v-if="interactiveTarget" class="guide-skip guide-skip--inline" role="button" tabindex="0" :aria-disabled="unavailable" :data-interaction="interaction_id('skip')" @click="request_action('skip')" @keydown.enter.stop.prevent="request_action('skip')" @keydown.space.stop.prevent="request_action('skip')">Skip</view>
          <view v-if="retained_step > 0" class="guide-back" role="button" tabindex="0" :aria-disabled="unavailable" :data-interaction="interaction_id('back')" @click="request_action('back')" @keydown.enter.stop.prevent="request_action('back')" @keydown.space.stop.prevent="request_action('back')"><SourceIcon class="guide-back-icon" name="back" /><text>Back</text></view>
          <view class="guide-next" role="button" tabindex="0" :aria-disabled="unavailable || nextDisabled" :data-interaction="interaction_id(final_step ? 'finish' : 'next')" @click="request_action('next')" @keydown.enter.stop.prevent="request_action('next')" @keydown.space.stop.prevent="request_action('next')"><text>{{ current.action }}</text><SourceIcon v-if="!final_step" class="guide-next-icon" name="arrow-right" /></view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.spotlight-guide { position: fixed; inset: 0; z-index: 1100; isolation: isolate; }
.spotlight-guide--interactive { pointer-events: none; }
.spotlight-guide--interactive .guide-scrim { pointer-events: none; }
.spotlight-guide--interactive .guide-scrim path { pointer-events: fill; }
.spotlight-guide--interactive .guide-stage, .spotlight-guide--interactive .guide-progress { display: none; }
.spotlight-guide--interactive .guide-card { padding-top: 11.45rpx; padding-bottom: 22.901rpx; }
.spotlight-guide--interactive .guide-card-head { min-height: 34.351rpx; }
.spotlight-guide--interactive .guide-card-footer { padding-top: 15.267rpx; }
.spotlight-guide--interactive .guide-title { font-size: 34.351rpx; line-height: 1.25; }
.spotlight-guide--interactive .guide-description { margin-top: 11.45rpx; }
.spotlight-guide--interactive .guide-skip--inline { flex: none; margin-right: 0; font-size: 24.809rpx; }
.guide-safe-top, .guide-safe-bottom { position: absolute; width: 1rpx; visibility: hidden; pointer-events: none; }
.guide-safe-top { height: var(--app-safe-top, 0px); }
.guide-safe-bottom { height: var(--app-safe-bottom, 0px); }
.guide-scrim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: var(--cimoa-surface-guide-scrim);
  opacity: 0;
  transition: opacity var(--guide-leave) ease;
}
.spotlight-guide--open .guide-scrim { opacity: 1; transition-duration: var(--guide-enter); }
.guide-spotlight {
  position: absolute;
  border-radius: 64.885rpx;
  border: 1px solid var(--cimoa-surface-guide-line);
  box-shadow: var(--cimoa-shadow-guide-spotlight);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--guide-enter) ease, left var(--guide-enter) ease, top var(--guide-enter) ease, width var(--guide-enter) ease, height var(--guide-enter) ease;
}
.spotlight-guide--open .guide-spotlight { opacity: 1; }
.guide-spotlight-line {
  position: absolute;
  inset: -3.817rpx;
  border-radius: inherit;
  padding: 1px;
  background: var(--cimoa-gradient-primary);
  opacity: 0.72;
  mask: var(--cimoa-gradient-card-fill) content-box exclude, var(--cimoa-gradient-card-fill);
  -webkit-mask: var(--cimoa-gradient-card-fill) content-box, var(--cimoa-gradient-card-fill);
  -webkit-mask-composite: xor;
}
.guide-card {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 19.084rpx 38.168rpx 34.351rpx;
  border: 1px solid var(--cimoa-surface-guide-line);
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-guide-glass);
  box-shadow: var(--cimoa-shadow-guide-card);
  backdrop-filter: blur(30.534rpx);
  -webkit-backdrop-filter: blur(30.534rpx);
  opacity: 0;
  transform: translateY(26.718rpx);
  transition: opacity var(--guide-leave) ease, transform var(--guide-leave) ease;
  overflow: hidden;
  color: var(--cimoa-text-title);
  outline: none;
  pointer-events: auto;
}
.spotlight-guide--open .guide-card { opacity: 1; transform: translateY(0); transition-duration: var(--guide-enter); }
.guide-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  min-height: calc(84rpx * var(--app-touch-scale, 1));
  gap: 19.084rpx;
}
.guide-heading { display: flex; align-items: center; gap: 19.084rpx; }
.guide-kicker { color: var(--cimoa-text-settings-purple); font-size: 19.084rpx; font-weight: 700; letter-spacing: 2.29rpx; }
.guide-counter { font-size: 24.809rpx; font-weight: 700; }
.guide-counter-separator { color: var(--cimoa-text-secondary); font-weight: 500; }
.guide-skip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: calc(84rpx * var(--app-touch-scale, 1));
  min-height: calc(84rpx * var(--app-touch-scale, 1));
  margin-right: -15.267rpx;
  color: var(--cimoa-text-secondary);
  font-size: 26.718rpx;
  font-weight: 600;
  border-radius: 22.901rpx;
}
.guide-stage {
  position: relative;
  flex: none;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 125.954rpx;
  margin: 0 0 26.718rpx;
  isolation: isolate;
}
.guide-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 110.687rpx;
  height: 110.687rpx;
  padding: 28.626rpx;
  border-radius: 38.168rpx;
  background: var(--cimoa-gradient-lightning);
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-lightning);
  box-sizing: border-box;
}
.guide-stage-glow {
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: 50%;
  background: var(--cimoa-gradient-guide-stage);
  filter: blur(22.901rpx);
  transform: scale(0.82);
  opacity: 0;
}
.spotlight-guide--open .guide-stage-glow { animation: guide-arc-arrival var(--guide-enter) ease both; }
.guide-encounter { position: relative; width: 354.962rpx; height: 125.954rpx; }
.guide-encounter-arc { position: absolute; width: 100%; height: 100%; top: -7.634rpx; opacity: 0.82; }
.guide-arc-cyan { stop-color: var(--cimoa-brand-cyan); }
.guide-arc-blue { stop-color: var(--cimoa-brand-blue); }
.guide-arc-pink { stop-color: var(--cimoa-brand-pink); }
.guide-person {
  position: absolute;
  top: 24.809rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 91.603rpx;
  height: 91.603rpx;
  padding: 24.809rpx;
  border-radius: 50%;
  box-sizing: border-box;
  border: 1px solid var(--cimoa-surface-guide-line);
}
.guide-person--first { left: 19.084rpx; background: var(--cimoa-surface-settings-blue); color: var(--cimoa-text-settings-blue); }
.guide-person--second { right: 19.084rpx; background: var(--cimoa-surface-settings-purple); color: var(--cimoa-text-settings-purple); }
.guide-body { flex: none; min-height: 0; }
.guide-copy { padding-bottom: 1.908rpx; }
.guide-title {
  display: block;
  font-size: 43.893rpx;
  line-height: 1.22;
  font-weight: 700;
  letter-spacing: -0.954rpx;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
.guide-description {
  display: block;
  margin-top: 19.084rpx;
  color: var(--cimoa-text-secondary);
  font-size: 28.626rpx;
  line-height: 1.5;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
.guide-error {
  display: block;
  margin-top: 19.084rpx;
  padding: 15.267rpx 19.084rpx;
  border-radius: 19.084rpx;
  background: var(--cimoa-surface-toast-error);
  color: var(--cimoa-text-auth-error);
  font-size: 26.718rpx;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.guide-card-footer { flex: none; padding-top: 24.809rpx; }
.guide-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9.542rpx;
  height: 11.45rpx;
  margin-bottom: 24.809rpx;
}
.guide-progress-dot { width: 11.45rpx; height: 7.634rpx; border-radius: 7.634rpx; background: var(--cimoa-surface-refresh-track); transition: width var(--guide-detail) ease, opacity var(--guide-detail) ease; }
.guide-progress-dot--current { width: 41.985rpx; background: var(--cimoa-gradient-primary); }
.guide-progress-dot--past { background: var(--cimoa-brand-blue); opacity: 0.45; }
.guide-actions { display: flex; align-items: stretch; gap: 15.267rpx; }
.guide-next {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 15.267rpx;
  min-height: max(91.603rpx, calc(84rpx * var(--app-touch-scale, 1)));
  padding: 13.359rpx 19.084rpx;
  border-radius: 49.618rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  font-size: 30.534rpx;
  font-weight: 700;
  line-height: 1.25;
  box-sizing: border-box;
}
.guide-next-icon { width: 34.351rpx; height: 34.351rpx; flex: none; }
.guide-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5.725rpx;
  min-width: calc(84rpx * var(--app-touch-scale, 1));
  min-height: max(91.603rpx, calc(84rpx * var(--app-touch-scale, 1)));
  padding-right: 15.267rpx;
  color: var(--cimoa-text-secondary);
  font-size: 28.626rpx;
  font-weight: 600;
  border-radius: 26.718rpx;
}
.guide-back-icon { width: 30.534rpx; height: 30.534rpx; }
.guide-skip:focus-visible, .guide-next:focus-visible, .guide-back:focus-visible { outline: 2px solid var(--cimoa-button-primary); outline-offset: 3.817rpx; }
[aria-disabled="true"] { cursor: default; }
.guide-next[aria-disabled="true"] { opacity: 0.68; }
@keyframes guide-arc-arrival {
  from { transform: scale(0.82); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .guide-card, .spotlight-guide--open .guide-card { transform: none; transition-property: opacity; }
  .guide-spotlight { transition-property: opacity; }
  .guide-progress-dot { transition-property: opacity; }
  .spotlight-guide--open .guide-stage-glow { animation: none; transform: none; opacity: 1; }
}
</style>

