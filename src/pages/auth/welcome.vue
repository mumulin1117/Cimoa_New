<script setup>
import { computed, nextTick, ref, onMounted, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { terms_document, privacy_document, community_document } from '@/utils/legalDocuments.js'
import { auth_destination } from '@/utils/authNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import AgreementSheet from '@/components/AgreementSheet.vue'
import EulaConfirmDialog from '@/components/EulaConfirmDialog.vue'
import AuthActionLoading from '@/components/AuthActionLoading.vue'
import BrandProgressMark from '@/components/BrandProgressMark.vue'
import { auth_message } from '@/utils/authFeedback.js'
import { show_toast } from '@/utils/toast.js'
import { campus_preload, CAMPUS_PHOTO } from '@/utils/startupCampus.js'
import { MOTION } from '@/config/navigation.js'
import { create_startup_reveal_settler } from '@/utils/startupHandoff.js'
const frame = ref(null), error = ref(''), photo_loaded = ref(false), photo_failed = ref(false), photo_key = ref(0)
const preparation = ref(campus_preload.snapshot()), story = campus_preload.consume()
const startup_phase = ref(story ? 'waiting' : 'warm')
const document_visible = ref(globalThis.document?.visibilityState !== 'hidden')
const presentation_ready = computed(() => ['complete', 'warm'].includes(startup_phase.value))
const reveal_settler = create_startup_reveal_settler()
const photo_status = computed(() => photo_failed.value || preparation.value.status === 'error' ? 'error' : photo_loaded.value && preparation.value.status === 'ready' ? 'ready' : 'loading')
const unsubscribe_photo = campus_preload.subscribe(value => { preparation.value = value })
onUnmounted(unsubscribe_photo)
const store = use_app_store(), agreed = computed(() => store.has_app_consent), eula_open = ref(false), document = ref(null)
const documents = { terms: terms_document, privacy: privacy_document, community: community_document }
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let prompted = false, visible = false, presentation = 0
const reveal_campus = () => { if (startup_phase.value === 'waiting') startup_phase.value = 'running' }
const page_presented = async () => {
  if (!visible) return
  const token = ++presentation
  // Retry may have already released the native cover to show Splash's honest
  // error. Its later Welcome is still this page's first visible entrance.
  if (startup_phase.value === 'waiting') reveal_campus()
  await nextTick()
  const settled = await reveal_settler.wait(frame.value?.$el)
  if (!settled || !visible || token !== presentation) return
  if (startup_phase.value === 'waiting' || startup_phase.value === 'running') startup_phase.value = 'complete'
  if (!prompted) { prompted = true; eula_open.value = !agreed.value }
}
const visibility_changed = () => {
  document_visible.value = globalThis.document.visibilityState !== 'hidden'
  if (!document_visible.value) { presentation++; reveal_settler.cancel(); campus_preload.cancel() }
  else if (visible) campus_preload.start()
}
onMounted(() => globalThis.document?.addEventListener('visibilitychange', visibility_changed))
onShow(() => { visible = true; campus_preload.start() })
onHide(() => { visible = false; presentation++; reveal_settler.cancel(); campus_preload.cancel(); if (startup_phase.value === 'running') startup_phase.value = 'complete'; cancel_loading(); eula_open.value = false; document.value = null })
onUnmounted(() => { visible = false; presentation++; reveal_settler.cancel(); globalThis.document?.removeEventListener('visibilitychange', visibility_changed) })
const go = async target => {
  if (is_loading.value || eula_open.value || document.value || !presentation_ready.value) return
  error.value = ''
  try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { show_toast(auth_message(cause.message), { tone: 'error' }) }
}
const continue_to = target => {
  if (is_loading.value || eula_open.value || !presentation_ready.value) return
  if (!agreed.value) { error.value = 'Please agree to the Terms and Privacy Policy to continue.'; return }
  return go(target)
}
const toggle_agreement = () => {
  if (is_loading.value || eula_open.value || !presentation_ready.value) return
  error.value = ''
  if (!agreed.value) { eula_open.value = true; return }
  const result = store.set_app_consent(false)
  if (!result.success) error.value = result.message
}
const accept_eula = async () => {
  if (is_loading.value || !eula_open.value || document.value) return
  error.value = ''
  const result = await run_with_loading(() => store.set_app_consent(true))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = auth_message(result.message); show_toast(error.value, { tone: 'error' }); return }
  eula_open.value = false
  if (store.session.is_authenticated || store.local_verification) {
    try { await frame.value.navigate_replace(startup_destination(store)) } catch (cause) { show_toast(auth_message(cause.message), { tone: 'error' }) }
  }
}
const decline_eula = () => { if (!is_loading.value) { eula_open.value = false; error.value = '' } }
const retry_photo = () => { photo_loaded.value = false; photo_failed.value = false; campus_preload.start({ retry: true }); photo_key.value++ }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="welcome-page" :class="{ 'welcome-page--hidden': !document_visible }" :data-startup-story="story ? 'cold' : 'warm'" :data-startup-phase="startup_phase" :data-campus-status="photo_status" :style="{ '--welcome-reveal-duration': `${MOTION.startup_handoff}ms` }" reduced-fade @revealing="reveal_campus" @presented="page_presented">
    <view class="welcome-photo-region">
      <image :key="photo_key" class="welcome-photo" :class="{ 'welcome-photo--ready': photo_status === 'ready' }" :src="CAMPUS_PHOTO" mode="aspectFill" aria-label="Students walking on campus" @load="photo_loaded = true" @error="photo_failed = true" />
      <view v-if="startup_phase === 'running'" class="welcome-campus-halo" data-startup-reveal aria-hidden="true"><svg viewBox="0 0 393 460" preserveAspectRatio="none"><defs><linearGradient id="cimoa-campus-arc" x1="0" y1="0" x2="393" y2="0" gradientUnits="userSpaceOnUse"><stop class="campus-arc-cyan" /><stop class="campus-arc-purple" offset=".5" /><stop class="campus-arc-pink" offset="1" /></linearGradient></defs><path d="M-40 430C-40 85 433 85 433 430" stroke="url(#cimoa-campus-arc)" stroke-width="22" fill="none" /></svg></view>
      <view v-if="photo_status === 'ready'" class="welcome-energy" aria-hidden="true"><view class="welcome-energy-dot welcome-energy-dot--cyan" /><view class="welcome-energy-dot welcome-energy-dot--purple" /><view class="welcome-energy-dot welcome-energy-dot--pink" /></view>
      <view v-if="photo_status !== 'ready'" class="welcome-photo-status" :role="photo_status === 'error' ? 'alert' : 'status'" :aria-busy="photo_status === 'loading'">
        <view v-if="photo_status === 'loading'" class="welcome-photo-loading-mark"><BrandProgressMark /></view>
        <text>{{ photo_status === 'loading' ? 'Loading campus photo…' : 'The campus photo could not load.' }}</text>
        <view v-if="photo_status === 'error'" role="button" tabindex="0" @click="retry_photo" @keydown.enter="retry_photo">Retry photo</view>
      </view>
    </view>
    <template #footer>
      <view class="welcome-copy" data-startup-reveal><text class="welcome-brand">Cimoa</text><text class="welcome-title">Meet your campus</text><text class="welcome-description">Discover people, conversations, and events around university life.</text></view>
      <view class="welcome-footer" data-startup-reveal :inert="eula_open || is_loading || !presentation_ready ? true : null">
        <text v-if="error && !eula_open" class="welcome-error" role="alert">{{ auth_message(error) }}</text>
        <view class="welcome-create" role="button" tabindex="0" :aria-disabled="!agreed" data-interaction="welcome.goAge.click.1" @click="continue_to('/pages/auth/age')" @keydown.enter="continue_to('/pages/auth/age')"><text>Create Account</text><SourceIcon name="arrow-right" :stroke-width="2.4" /></view>
        <view class="welcome-login" role="button" tabindex="0" :aria-disabled="!agreed" data-interaction="welcome.goLogin.click.1" @click="continue_to('/pages/auth/login')" @keydown.enter="continue_to('/pages/auth/login')">Log In</view>
        <view class="welcome-consent">
          <view class="welcome-consent-toggle" :class="{ 'is-checked': agreed }" role="checkbox" tabindex="0" aria-label="I agree to the Terms and Privacy Policy." :aria-checked="agreed" data-interaction="welcome.toggleAgreement.click.1" @click="toggle_agreement" @keydown.enter="toggle_agreement" @keydown.space.prevent="toggle_agreement"><SourceIcon v-if="agreed" name="check" :stroke-width="3.2" /></view>
          <view class="welcome-consent-copy"><text>I agree to the </text><text class="welcome-consent-link" role="button" tabindex="0" data-interaction="welcome.consent.openTerms.click.1" @click="go('/pages/legal/terms')" @keydown.enter="go('/pages/legal/terms')">Terms</text><text> and </text><text class="welcome-consent-link" role="button" tabindex="0" data-interaction="welcome.consent.openPrivacy.click.1" @click="go('/pages/legal/privacy')" @keydown.enter="go('/pages/legal/privacy')">Privacy Policy</text><text>.</text></view>
        </view>
        <view class="welcome-legal"><text>By continuing, you agree to our </text><text class="welcome-link" role="button" tabindex="0" data-interaction="welcome.openTerms.click.1" @click="go('/pages/legal/terms')" @keydown.enter="go('/pages/legal/terms')">Terms</text><text> and </text><text class="welcome-link" role="button" tabindex="0" data-interaction="welcome.openPrivacy.click.1" @click="go('/pages/legal/privacy')" @keydown.enter="go('/pages/legal/privacy')">Privacy Policy</text><text>.</text></view>
      </view>
    </template>
    <template #overlays>
      <EulaConfirmDialog :open="eula_open" :busy="is_loading" :suspended="!!document" :error="error ? auth_message(error) : ''" @confirm="accept_eula" @decline="decline_eula" @read="document = documents[$event]" />
      <AgreementSheet :open="!!document" :document="document" @close="document = null" />
      <AuthActionLoading :visible="is_loading" label="Confirming your agreement…" />
    </template>
  </SecondaryPageFrame>
</template>
<style scoped>
.welcome-page :deep(.secondary-page-scroll .uni-scroll-view-content) { height: 100%; }
.welcome-page[data-startup-story='cold'] :deep(.page-transition) { animation: none; opacity: 1; transform: none; }
.welcome-page[data-startup-phase='waiting'] .welcome-photo--ready { opacity: 0; }
.welcome-page[data-startup-phase='waiting'] .welcome-copy,
.welcome-page[data-startup-phase='waiting'] .welcome-footer { opacity: 0; transform: translateY(26.718rpx); }
.welcome-page[data-startup-phase='running'] .welcome-copy,
.welcome-page[data-startup-phase='running'] .welcome-footer { animation: welcome-content-rise var(--welcome-reveal-duration) ease both; }
.welcome-page--hidden .welcome-copy,
.welcome-page--hidden .welcome-footer,
.welcome-page--hidden .welcome-campus-halo,
.welcome-page--hidden .welcome-photo,
.welcome-page--hidden .welcome-energy-dot,
.welcome-page--hidden .welcome-create { animation-play-state: paused; }
.welcome-photo-region { position: relative; isolation: isolate; margin: 0 7.634rpx; height: 100%; }
.welcome-photo-region::after { content: ''; position: absolute; z-index: 1; right: -38.168rpx; bottom: -11.45rpx; left: -38.168rpx; height: 244.275rpx; background: var(--cimoa-gradient-welcome-photo-aura); pointer-events: none; }
.welcome-photo {
  position: relative;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 57.252rpx 57.252rpx 0 0;
  object-position: center top;
  mask-image: var(--cimoa-gradient-welcome-mask);
  -webkit-mask-image: var(--cimoa-gradient-welcome-mask);
  opacity: 0;
  box-shadow: var(--cimoa-shadow-welcome-photo);
  transition: opacity var(--welcome-reveal-duration) ease-out;
}
.welcome-photo--ready { opacity: 1; animation: welcome-photo-breathe 7s ease-in-out infinite alternate; }
.welcome-energy { position: absolute; z-index: 2; inset: 0; overflow: hidden; pointer-events: none; }
.welcome-energy-dot { position: absolute; border-radius: 50%; animation: welcome-energy-float 4.8s ease-in-out infinite; }
.welcome-energy-dot--cyan { top: 78%; left: 12%; width: 17.176rpx; height: 17.176rpx; background: var(--cimoa-brand-cyan); }
.welcome-energy-dot--purple { top: 71%; right: 20%; width: 11.45rpx; height: 11.45rpx; background: var(--cimoa-brand-purple); animation-delay: -1.6s; }
.welcome-energy-dot--pink { top: 82%; right: 9%; width: 7.634rpx; height: 7.634rpx; background: var(--cimoa-brand-pink); animation-delay: -3.1s; }
.welcome-campus-halo { position: absolute; inset: 0; pointer-events: none; opacity: 0; transform-origin: 50% 72%; animation: campus-unfold var(--welcome-reveal-duration) ease-out both; }
.welcome-campus-halo svg { width: 100%; height: 100%; filter: blur(15.267rpx); }
.campus-arc-cyan { stop-color: var(--cimoa-brand-cyan); }
.campus-arc-purple { stop-color: var(--cimoa-brand-arc-mid); }
.campus-arc-pink { stop-color: var(--cimoa-brand-pink); }
@keyframes campus-unfold { from { opacity: .25; transform: scale(.78); } to { opacity: 0; transform: scale(1.24); } }
@keyframes welcome-content-rise { from { opacity: 0; transform: translateY(26.718rpx); } to { opacity: 1; transform: none; } }
@keyframes welcome-content-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .welcome-campus-halo { display: none; animation: none; }
  .welcome-page[data-startup-phase='waiting'] .welcome-copy,
  .welcome-page[data-startup-phase='waiting'] .welcome-footer { transform: none; }
  .welcome-page[data-startup-phase='running'] .welcome-copy,
  .welcome-page[data-startup-phase='running'] .welcome-footer { animation-name: welcome-content-fade; }
}
.welcome-photo :deep(.uni-image-element),
.welcome-photo :deep(img) { object-position: center top; }
.welcome-photo-status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22.901rpx;
  color: var(--cimoa-text-secondary);
  font-size: 28.626rpx;
}
.welcome-photo-status [role=button] { color: var(--cimoa-text-link); }
.welcome-photo-loading-mark { flex: none; width: 61.069rpx; height: 61.069rpx; }
.welcome-copy {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  margin: 83.969rpx 45.802rpx 7.634rpx;
  text-align: center;
}
.welcome-brand {
  font-size: 72.519rpx;
  font-weight: 500;
  letter-spacing: .08em;
  padding-left: .08em;
  color: var(--cimoa-surface-transparent);
  background: var(--cimoa-gradient-auth-heading-mark);
  background-clip: text;
  -webkit-background-clip: text;
  line-height: 1;
}
.welcome-title {
  margin-top: 41.985rpx;
  font-size: 64.885rpx;
  font-weight: 800;
  letter-spacing: -.04em;
  line-height: 1.05;
  color: var(--cimoa-text-welcome-title);
}
.welcome-description {
  max-width: 553.435rpx;
  margin-top: 19.084rpx;
  font-size: 31.489rpx;
  color: var(--cimoa-text-welcome-copy);
  line-height: 1.4;
  text-wrap: balance;
}
.welcome-footer { display: flex; flex: none; flex-direction: column; gap: 22.901rpx; padding: 0 38.168rpx 57.252rpx; }
.welcome-create {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15.267rpx;
  height: 114.504rpx;
  overflow: hidden;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  background-size: 180% 100%;
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-auth-action);
  font-size: 36.26rpx;
  font-weight: 700;
  animation: welcome-gradient-drift 5.2s ease-in-out infinite alternate;
  transition: transform var(--auth-press-out, 180ms) ease,box-shadow var(--auth-press-out, 180ms) ease;
}
.welcome-create::after { content: ''; position: absolute; z-index: -1; top: -34.351rpx; bottom: -34.351rpx; left: -68.702rpx; width: 45%; background: var(--cimoa-gradient-auth-shine); transform: translateX(-180%) skewX(-12deg); animation: welcome-shine-pass 4.6s ease-in-out infinite; pointer-events: none; }
.welcome-create .source-icon { width: 34.351rpx; height: 34.351rpx; }
.welcome-create[data-touch-state='pressed'], .welcome-create[data-touch-state='held'] { transform: scale(.975); box-shadow: var(--cimoa-shadow-welcome-action-active); }
.welcome-create[data-touch-state='pressed'] .source-icon, .welcome-create[data-touch-state='held'] .source-icon { transform: translateX(7.634rpx); }
.welcome-login {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 106.87rpx;
  border: 1px solid transparent;
  border-radius: 53.435rpx;
  background: var(--cimoa-gradient-auth-field-fill) padding-box,var(--cimoa-gradient-welcome-login-border) border-box;
  box-shadow: var(--cimoa-shadow-auth-secondary);
  color: var(--cimoa-text-title);
  font-size: 34.351rpx;
  font-weight: 600;
  transition: transform var(--auth-press-out, 180ms) ease,box-shadow var(--auth-press-out, 180ms) ease;
}
.welcome-login[data-touch-state='pressed'], .welcome-login[data-touch-state='held'] { transform: scale(.98); box-shadow: var(--cimoa-shadow-auth-back-active); }
.welcome-legal { margin-top: 3.817rpx; font-size: 27.672rpx; color: var(--cimoa-text-auth-muted); line-height: 1.4; text-align: center; }
.welcome-consent { display: flex; align-items: center; gap: 22.901rpx; }
.welcome-consent-toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 45.802rpx;
  height: 45.802rpx;
  border: 1px solid var(--cimoa-surface-deep);
  border-radius: 22.901rpx;
  color: var(--cimoa-text-inverse);
  cursor: pointer;
  transition: transform var(--auth-press-out, 180ms) ease,background var(--auth-press-out, 180ms) ease,border-color var(--auth-press-out, 180ms) ease;
}
.welcome-consent-toggle.is-checked { border-color: var(--cimoa-surface-transparent); background: var(--cimoa-gradient-primary); }
.welcome-consent-toggle.is-checked .source-icon { animation: welcome-check-pop var(--auth-press-out, 180ms) ease-out both; }
.welcome-consent-toggle .source-icon { width: 38.168rpx; height: 38.168rpx; }
.welcome-consent-copy { min-width: 0; font-size: 23.378rpx; line-height: 1.4; letter-spacing: -.005em; color: var(--cimoa-text-welcome-copy); }
.welcome-consent-link { color: var(--cimoa-text-title); cursor: pointer; }
.welcome-link { text-decoration: underline; color: var(--cimoa-text-auth-legal); font-weight: 600; }
.welcome-error { font-size: 27.672rpx; line-height: 1.4; color: var(--cimoa-status-danger); }
@keyframes welcome-photo-breathe { from { transform: scale(1); } to { transform: scale(1.018); } }
@keyframes welcome-energy-float { 0%,100% { opacity: .28; transform: translateY(11.45rpx) scale(.8); } 50% { opacity: .88; transform: translateY(-19.084rpx) scale(1.08); } }
@keyframes welcome-gradient-drift { from { background-position: 0 50%; } to { background-position: 100% 50%; } }
@keyframes welcome-shine-pass { 0%,58% { transform: translateX(-180%) skewX(-12deg); } 78%,100% { transform: translateX(420%) skewX(-12deg); } }
@keyframes welcome-check-pop { from { opacity: 0; transform: scale(.5) rotate(-18deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
@media (prefers-reduced-motion: reduce) {
  .welcome-photo--ready, .welcome-energy-dot, .welcome-create, .welcome-create::after, .welcome-consent-toggle.is-checked .source-icon { animation: none; }
  .welcome-create[data-touch-state], .welcome-login[data-touch-state] { transform: none; }
}
</style>
