<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { MOTION } from '@/config/navigation.js'
import { present_auth_step_motion, clear_auth_step_motion } from '@/utils/authStepMotion.js'
import { use_app_store } from '@/stores/store.js'
import { use_visual_viewport } from '@/composables/useEventViewport.js'
import SecondaryPageFrame from './SecondaryPageFrame.vue'
import SourceIcon from './SourceIcon.vue'
import AuthActionLoading from './AuthActionLoading.vue'
const props = defineProps({ step: String, busy: Boolean, error: String, accessError: String, interaction: String, backInteraction: String, sourceIndex: Number, sourceTotal: Number, sourceProgress: Number, disabled: Boolean, button: { type: String, default: 'Continue' } })
const emit = defineEmits(['back', 'continue', 'recover']), store = use_app_store(), frame = ref(null)
const steps = computed(() => store.onboarding_catalog.steps), index = computed(() => steps.value.indexOf(props.step) + 1)
const display_index = computed(() => props.sourceIndex ?? index.value), display_total = computed(() => props.sourceTotal ?? steps.value.length)
const progress = computed(() => props.sourceProgress ?? display_index.value / display_total.value * 100)
const { height: viewport_height, keyboard_open } = use_visual_viewport()
const navigation_busy = ref(false), locked = computed(() => props.busy || navigation_busy.value)
const progress_plan = ref({ from: progress.value, to: progress.value, animate: false, revision: 0 })
const motion_style = { '--auth-press-in': `${MOTION.press_in}ms`, '--auth-press-out': `${MOTION.press_out}ms`, '--auth-step-duration': `${MOTION.page}ms` }
let pending_navigation = null, active = false, disposed = false, reduced_query
const show_progress = () => {
  progress_plan.value = present_auth_step_motion({ context: store.auth_context, step: props.step, index: index.value - 1, progress: progress.value, allowed: !props.accessError && !!store.onboarding && !store.onboarding.completed, reduced: !!reduced_query?.matches })
}
const show = () => { if (!active && !disposed) { active = true; show_progress() } }
const reset_visuals = () => {
  pending_navigation = null; navigation_busy.value = false
  progress_plan.value = { ...progress_plan.value, from: progress.value, to: progress.value, animate: false }
}
const hide = () => { active = false; reset_visuals() }
const reduced_changed = () => { if (active) show_progress() }
const visibility_changed = () => { if (document.visibilityState === 'hidden') { clear_auth_step_motion(); reset_visuals() } }
const navigate = (method, target) => {
  if (!active || disposed) return Promise.resolve(false)
  if (pending_navigation) return pending_navigation.method === method && pending_navigation.target === target ? pending_navigation.promise : Promise.resolve(false)
  navigation_busy.value = true
  const task = { method, target }
  task.promise = Promise.resolve().then(() => active && !disposed && pending_navigation === task ? frame.value[method](target) : false).finally(() => {
    if (pending_navigation === task) { pending_navigation = null; navigation_busy.value = false }
  })
  pending_navigation = task
  return task.promise
}
watch(() => [store.auth_context, props.step, progress.value, props.accessError], () => { if (active) show_progress() })
onShow(show)
onHide(hide)
onMounted(() => {
  if (typeof window !== 'undefined') { reduced_query = window.matchMedia?.('(prefers-reduced-motion: reduce)'); reduced_query?.addEventListener?.('change', reduced_changed) }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility_changed)
  show()
  if (reduced_query?.matches) show_progress()
})
onUnmounted(() => {
  disposed = true; hide()
  reduced_query?.removeEventListener?.('change', reduced_changed)
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility_changed)
})
defineExpose({
  navigate_forward: target => navigate('navigate_forward', target),
  navigate_replace: target => navigate('navigate_replace', target),
  navigate_relaunch: target => navigate('navigate_relaunch', target),
  navigate_back: fallback => navigate('navigate_back', fallback),
})
</script>
<template>
  <SecondaryPageFrame ref="frame" class="onboarding-page" content-motion :class="[`onboarding-${step}-page`, { 'onboarding-page--keyboard': keyboard_open }]" :style="{ ...motion_style, height: viewport_height, '--app-safe-bottom': keyboard_open ? '0px' : undefined }" :aria-busy="locked">
    <template #header><view class="onboarding-header" :class="{ 'onboarding-header--ice': step === 'ice' }"><view class="onboarding-back" role="button" tabindex="0" aria-label="Back" :aria-disabled="locked" :data-interaction="backInteraction" @click="!locked && emit('back')" @keydown.enter="!locked && emit('back')"><SourceIcon name="back" /></view><text v-if="step === 'ice'" class="ice-progress">Profile setup · {{ display_index }} of {{ display_total }}</text><view class="onboarding-track"><view :key="progress_plan.revision" class="onboarding-fill" :class="{ 'onboarding-fill--moving': progress_plan.animate }" :style="{ width: `${progress}%`, '--auth-step-from': `${progress_plan.from}%`, '--auth-step-to': `${progress_plan.to}%` }" /></view><text v-if="step !== 'ice'" class="onboarding-step">{{ display_index }} / {{ display_total }}</text></view></template>
    <view class="onboarding-content" :inert="navigation_busy ? '' : undefined"><template v-if="!accessError"><slot /><text v-if="error" class="auth-error-box" role="alert">{{ auth_message(error) }}</text></template><text v-else class="auth-error-box" role="alert">{{ auth_message(accessError) }}</text></view>
    <template #footer><view class="onboarding-footer" :inert="navigation_busy ? '' : undefined"><slot name="hint" /><view v-if="!accessError" class="auth-primary" :class="{ 'is-disabled': disabled }" role="button" tabindex="0" :aria-disabled="locked || disabled" :data-interaction="interaction" @click="!locked && !disabled && emit('continue')" @keydown.enter="!locked && !disabled && emit('continue')">{{ button }}<slot name="button-icon" /></view><view v-else class="auth-primary" role="button" tabindex="0" :aria-disabled="locked" @click="!locked && emit('recover')" @keydown.enter="!locked && emit('recover')">Continue account setup</view></view></template>
    <template #overlays><slot name="overlays" /><AuthActionLoading :visible="busy" label="Updating your profile…" /></template>
  </SecondaryPageFrame>
</template>
<style>
@import '../pages/auth/auth.css';
</style>
<style scoped>
.onboarding-header { display: flex; align-items: center; gap: 26.718rpx; height: 91.603rpx; margin: 7.634rpx 38.168rpx 34.351rpx; }
.onboarding-back { flex: none; width: 87.786rpx; height: 87.786rpx; border-radius: 43.893rpx; display: flex; align-items: center; justify-content: center; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-header); }
.onboarding-back .source-icon { width: 41.985rpx; height: 41.985rpx; }
.onboarding-track { flex: 1; height: 11.45rpx; border-radius: 5.725rpx; background: var(--cimoa-surface-splash-track); overflow: hidden; }
.onboarding-track view { height: 100%; border-radius: inherit; background: var(--cimoa-gradient-primary); }
.onboarding-fill--moving { animation: auth-step-progress var(--auth-step-duration) linear both; }
@keyframes auth-step-progress { from { width: var(--auth-step-from); } to { width: var(--auth-step-to); } }
@media (prefers-reduced-motion: reduce) { .onboarding-fill--moving { animation: none; } }
.onboarding-step { font-size: 25.763rpx; font-weight: 700; color: var(--cimoa-text-auth-placeholder); }
.onboarding-header--ice { position: relative; height: 133.588rpx; }
.onboarding-header--ice .onboarding-back { position: absolute; top: 0; left: 0; z-index: 1; }
.ice-progress { position: absolute; top: 0; width: 100%; text-align: center; font-size: 30.534rpx; font-weight: 500; color: var(--cimoa-text-secondary); }
.onboarding-header--ice .onboarding-track { position: absolute; top: 55.344rpx; left: 0; width: 100%; }
.onboarding-content { padding: 0 38.168rpx 45.802rpx; }
.onboarding-footer { display: flex; flex-direction: column; gap: 22.901rpx; padding: 0 38.168rpx 64.885rpx; }
.onboarding-page.onboarding-page--keyboard .onboarding-footer { padding-bottom: 15.267rpx; }
</style>
