<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { apply_theme } from '@/utils/theme.js'
import { install_safe_area_bridge, request_safe_area } from '@/utils/safeArea.js'

const refresh_environment = () => { apply_theme(); request_safe_area() }
const hydrate = () => {
  apply_theme(); install_safe_area_bridge(); request_safe_area(); use_app_store().hydrate()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', refresh_environment)
    window.addEventListener('orientationchange', refresh_environment)
    window.addEventListener('pageshow', refresh_environment)
  }
}
onLaunch(hydrate)
onShow(() => { apply_theme(); request_safe_area() })
</script>

<style>
@import '../static/assets/fonts/source-fonts.css';
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
