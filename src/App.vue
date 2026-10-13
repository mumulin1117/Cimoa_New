<script setup>
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { apply_theme } from '@/utils/theme.js'
import { install_safe_area_bridge, request_safe_area } from '@/utils/safeArea.js'

const hydrate = () => { apply_theme(); install_safe_area_bridge(); request_safe_area(); use_app_store().hydrate() }
onLaunch(hydrate)
onShow(() => { apply_theme(); request_safe_area() })
</script>

<style>
* { box-sizing: border-box; }
page { background: var(--cimoa-page); color: var(--cimoa-title); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
button, input, textarea { font-family: inherit; }
.cimoa-page { min-height: 100vh; background: var(--cimoa-page); color: var(--cimoa-title); }
.cimoa-scroll { height: calc(100vh - 176rpx); padding: 26rpx 32rpx 48rpx; }
.cimoa-header { display: flex; align-items: center; justify-content: space-between; padding: 4rpx 0 28rpx; }
.cimoa-eyebrow { display: block; color: var(--cimoa-tertiary); font-size: 18rpx; font-weight: 700; letter-spacing: 3rpx; text-transform: uppercase; }
.cimoa-title { display: block; color: var(--cimoa-title); font-size: 46rpx; font-weight: 700; line-height: 58rpx; letter-spacing: -1rpx; }
.cimoa-section-title { display: block; margin-top: 8rpx; color: var(--cimoa-title); font-size: 32rpx; font-weight: 700; line-height: 42rpx; }
.cimoa-muted { color: var(--cimoa-secondary); font-size: 23rpx; line-height: 34rpx; }
.cimoa-card { border: 1px solid var(--cimoa-border); border-radius: 26rpx; background: var(--cimoa-card); }
.cimoa-button { display: flex; align-items: center; justify-content: center; min-height: 86rpx; padding: 0 28rpx; border-radius: 100rpx; background: var(--cimoa-primary); color: var(--cimoa-primary-text); font-size: 24rpx; font-weight: 700; }
.cimoa-button.ghost { border: 1px solid var(--cimoa-outline); background: transparent; color: var(--cimoa-title); }.cimoa-button.danger { background: var(--cimoa-danger); color: var(--cimoa-card); }
.cimoa-avatar { overflow: hidden; width: 74rpx; height: 74rpx; border-radius: 50%; background: var(--cimoa-tinted); }.cimoa-avatar image { width: 100%; height: 100%; }
</style>
