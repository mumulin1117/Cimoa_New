<script setup>
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { onUnmounted, watch } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { apply_theme } from '@/utils/theme.js'
import { install_safe_area_bridge, request_safe_area } from '@/utils/safeArea.js'
import { install_host_bridge } from '@/utils/hostBridge.js'
import { install_purchase_bridge } from '@/utils/iapBridge.js'
import { install_toast_host } from '@/utils/toastHost.js'
import { clear_toast } from '@/utils/toast.js'
import { clear_auth_notice } from '@/utils/authNotice.js'
import { prepare_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { create_purchase_recovery } from '@/utils/nativePurchases.js'
import { install_purchase_loading_host } from '@/utils/purchaseLoadingHost.js'
import { show_toast } from '@/utils/toast.js'
import { install_touch_policy } from '@/utils/touchPolicy.js'
import { install_match_ignition_host } from '@/utils/matchIgnitionHost.js'
import { clear_match_ignition } from '@/utils/matchIgnition.js'
import { install_connection_visuals, clear_connection_visuals } from '@/utils/connectionVisuals.js'
import { clear_tab_motion } from '@/utils/tabMotion.js'
import { install_avatar_relay_host } from '@/utils/avatarRelayHost.js'
import { clear_avatar_relay } from '@/utils/avatarRelay.js'
import { clear_auth_step_motion } from '@/utils/authStepMotion.js'
import { clear_icebreaker_motion } from '@/utils/icebreakerMotion.js'
import { install_send_surface_host, install_auto_match_surface_host, install_match_preferences_surface_host } from '@/utils/sendSurfaceHost.js'
import { clear_send_surface, clear_auto_match_surface, clear_match_preferences_surface } from '@/utils/sendSurface.js'
import { stack_surface } from '@/utils/stackSurface.js'
import { stack_surface_context } from '@/composables/useStackSurface.js'

const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let purchase_recovery, stop_purchase_context, remove_purchase_loading, touch_policy, app_visible = true
let remove_ignition_host, remove_connection_visuals, remove_avatar_host, remove_surface_host, remove_auto_match_surface_host, remove_preferences_surface_host
let remove_stack_surface_host, stop_stack_context

const refresh_environment = () => { apply_theme(); request_safe_area() }
const hydrate = () => {
  touch_policy = install_touch_policy()
  apply_theme(); install_safe_area_bridge(); install_host_bridge(); install_purchase_bridge(); request_safe_area(); use_app_store().hydrate()
  const store = use_app_store()
  prepare_main_tab_skeleton(store.session.is_authenticated ? store.auth_context : null)
  install_toast_host()
  remove_surface_host = install_send_surface_host()
  remove_auto_match_surface_host = install_auto_match_surface_host()
  remove_preferences_surface_host = install_match_preferences_surface_host()
  remove_stack_surface_host = install_send_surface_host({ controller: stack_surface })
  stop_stack_context = watch(() => stack_surface_context(store), () => stack_surface.clear('identity-changed'), { flush: 'sync' })
  remove_ignition_host = install_match_ignition_host()
  remove_avatar_host = install_avatar_relay_host()
  remove_connection_visuals = install_connection_visuals(store)
  remove_purchase_loading = install_purchase_loading_host(is_loading)
  purchase_recovery = create_purchase_recovery({ store, run_with_loading, on_error: error => show_toast(typeof error === 'string' ? error : error?.message || 'Your purchase couldn’t be confirmed. Reopen Coin Center to try again.', { tone: 'error' }) })
  purchase_recovery.start()
  stop_purchase_context = watch(() => store.auth_context, () => {
    clear_avatar_relay(); clear_tab_motion(); clear_match_ignition(); clear_connection_visuals(); clear_auth_step_motion(); clear_icebreaker_motion(); clear_send_surface(); clear_auto_match_surface(); clear_match_preferences_surface()
    cancel_loading()
    purchase_recovery.stop()
    if (app_visible) purchase_recovery.start()
  }, { flush: 'sync' })
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', refresh_environment)
    window.addEventListener('orientationchange', refresh_environment)
    window.addEventListener('pageshow', refresh_environment)
  }
}
onLaunch(hydrate)
onHide(() => stack_surface.clear('background'))
onUnmounted(() => { stack_surface.clear('host-removed'); stop_stack_context?.(); remove_stack_surface_host?.() })
onShow(() => { app_visible = true; apply_theme(); request_safe_area(); purchase_recovery?.start(); purchase_recovery?.refresh() })
onHide(() => { app_visible = false; clear_avatar_relay(); clear_tab_motion(); clear_match_ignition(); clear_connection_visuals(); clear_auth_step_motion(); clear_icebreaker_motion(); clear_send_surface(); clear_auto_match_surface(); clear_match_preferences_surface(); touch_policy?.cancel(); clear_toast(); clear_auth_notice(); purchase_recovery?.stop(); cancel_loading() })
onUnmounted(() => { clear_send_surface(); clear_auto_match_surface(); clear_match_preferences_surface(); remove_surface_host?.(); remove_auto_match_surface_host?.(); remove_preferences_surface_host?.(); clear_icebreaker_motion(); remove_avatar_host?.(); remove_ignition_host?.(); remove_connection_visuals?.(); clear_connection_visuals(); touch_policy?.dispose(); purchase_recovery?.stop(); stop_purchase_context?.(); remove_purchase_loading?.() })
</script>

<style>
@import '../static/assets/fonts/source-fonts.css';
@import './pages/profile/editor.css';
@import './pages/events/event-pages.css';
@import './pages/flow-pages.css';
@import './styles/touch.css';
:root { --app-safe-top: max(var(--status-bar-height, 0px), var(--native-safe-area-top, 0px), env(safe-area-inset-top, 0px)); --app-safe-bottom: max(var(--native-safe-area-bottom, 0px), env(safe-area-inset-bottom, 0px)); --app-main-tab-bar-height: calc(194.657rpx + var(--app-safe-bottom)); }
* { box-sizing: border-box; }
html, body, #app, uni-app, uni-page, uni-page-wrapper, uni-page-body { height: 100%; overflow: hidden; }
page { background: var(--cimoa-page); color: var(--cimoa-title); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
button, input, textarea { font-family: inherit; }
.cimoa-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--cimoa-page);
  color: var(--cimoa-title);
}
.cimoa-scroll { flex: 1; min-height: 0; height: 0; padding: 26rpx 32rpx 48rpx; }
.legacy-tab-content { padding: 26rpx 32rpx 48rpx; }
.legacy-tab-header { padding: 26rpx 32rpx 0; }
.cimoa-header { display: flex; align-items: center; justify-content: space-between; padding: 4rpx 0 28rpx; }
.cimoa-eyebrow {
  display: block;
  color: var(--cimoa-tertiary);
  font-size: 18rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  text-transform: uppercase;
}
.cimoa-title {
  display: block;
  color: var(--cimoa-title);
  font-size: 46rpx;
  font-weight: 700;
  line-height: 58rpx;
  letter-spacing: -1rpx;
}
.cimoa-section-title {
  display: block;
  margin-top: 8rpx;
  color: var(--cimoa-title);
  font-size: 32rpx;
  font-weight: 700;
  line-height: 42rpx;
}
.cimoa-muted { color: var(--cimoa-secondary); font-size: 23rpx; line-height: 34rpx; }
.cimoa-card { border: 1px solid var(--cimoa-border); border-radius: 26rpx; background: var(--cimoa-card); }
.cimoa-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 86rpx;
  padding: 0 28rpx;
  border-radius: 100rpx;
  background: var(--cimoa-primary);
  color: var(--cimoa-primary-text);
  font-size: 24rpx;
  font-weight: 700;
}
.cimoa-button.ghost { border: 1px solid var(--cimoa-outline); background: transparent; color: var(--cimoa-title); }
.cimoa-button.danger { background: var(--cimoa-danger); color: var(--cimoa-card); }
.cimoa-avatar { overflow: hidden; width: 74rpx; height: 74rpx; border-radius: 50%; background: var(--cimoa-tinted); }
.cimoa-avatar image { width: 100%; height: 100%; }
</style>
