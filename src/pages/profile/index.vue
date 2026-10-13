<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store, make_operation_id } from '@/stores/store.js'
import theme from '@/config/theme.json'
import { back_route, push_route, replace_route } from '@/utils/routeTransition.js'
import { request_purchase } from '@/utils/iapBridge.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import AppLoading from '@/components/AppLoading.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = use_app_store()
const view = ref('profile')
const show_logout = ref(false)
const notice = ref('')
const edit_name = ref('')
const edit_bio = ref('')
const { is_loading, run_with_loading } = use_write_loading()
const switch_color = theme.colors.button.primary
const current_user = computed(() => store.current_user)
const open_view = (next) => { view.value = next; notice.value = ''; if (next === 'edit') { edit_name.value = current_user.value.user_name; edit_bio.value = current_user.value.bio } }
const save_profile = async () => { const result = await run_with_loading(() => store.update_profile({ user_name: edit_name.value.trim(), bio: edit_bio.value.trim() })); if (result.success) { notice.value = 'Profile updated.'; view.value = 'profile' } }
const purchase = async (package_id) => {
  const result = await run_with_loading(async () => {
    const started = store.begin_purchase(package_id, make_operation_id())
    if (!started.success) return started
    const pack = store.coin_packages.find((row) => row.package_id === package_id)
    const response = await request_purchase({ request_id: started.data, package_id, owner_user_id: store.current_user.user_id, product_id: pack.product_id })
    const settled = await store.settle_purchase(started.data, response)
    return { ...settled, success: settled.success && settled.data?.status === 'success', reason: response.status }
  }, 450)
  notice.value = result.success ? 'Coins added to your wallet.' : result.reason === 'timeout' ? 'The App Store request timed out. Your balance is unchanged.' : 'Purchase was not completed.'
}
const logout = async () => { show_logout.value = false; const result = await run_with_loading(() => store.logout()); if (result.success) await replace_route('/pages/auth/index'); else notice.value = result.message }
const toggle_setting = async (key) => { const result = await run_with_loading(() => store.toggle_setting(key)); if (!result.success) notice.value = result.message }
onLoad((options) => { if (options?.view) view.value = options.view })
</script>

<template>
  <view class="cimoa-page profile-page">
    <TopSafeArea />
    <view class="sub-header"><view v-if="view !== 'profile'" class="back-button" role="button" @click="view = 'profile'">Back</view><view v-else class="back-placeholder" /><text class="sub-header__title">{{ view === 'profile' ? 'Profile' : view === 'coins' ? 'Coin center' : 'Settings' }}</text><view class="back-placeholder" /></view>
    <scroll-view class="cimoa-scroll" scroll-y :show-scrollbar="false">
      <template v-if="view === 'profile'">
        <view class="profile-intro"><view class="large-avatar cimoa-avatar"><image :src="current_user.avatar_url" mode="aspectFill" /></view><text class="profile-intro__name">{{ current_user.user_name }}</text><text class="profile-intro__meta">{{ current_user.major }} · {{ current_user.university }}</text><text class="profile-intro__bio">{{ current_user.bio }}</text></view>
        <view class="stats-row"><view><text class="stats-row__value">{{ store.event_count }}</text><text class="stats-row__label">Events</text></view><view><text class="stats-row__value">{{ store.unread_count }}</text><text class="stats-row__label">Unread</text></view><view><text class="stats-row__value">{{ current_user.coin_balance }}</text><text class="stats-row__label">Coins</text></view></view>
        <view class="menu-list"><view class="menu-item" role="button" @click="open_view('coins')"><view><text class="menu-item__title">Coin center</text><text class="menu-item__meta">{{ current_user.coin_balance }} coins available</text></view><text class="menu-item__action">Open</text></view><view class="menu-item" role="button" @click="push_route('/pages/messages/index')"><view><text class="menu-item__title">Messages</text><text class="menu-item__meta">Three connected conversations</text></view><text class="menu-item__action">Open</text></view><view class="menu-item" role="button" @click="open_view('settings')"><view><text class="menu-item__title">Settings</text><text class="menu-item__meta">Notifications, privacy, blocked accounts</text></view><text class="menu-item__action">Open</text></view></view><view class="profile-actions"><view class="cimoa-button" role="button" @click="open_view('edit')">Edit profile</view><view class="cimoa-button ghost" role="button" @click="show_logout = true">Log out</view></view>
      </template>
      <template v-else-if="view === 'edit'"><text class="cimoa-section-title section-title">Edit profile</text><input v-model="edit_name" class="edit-input" placeholder="Your name" /><textarea v-model="edit_bio" class="edit-textarea" placeholder="A short bio" /><view class="cimoa-button" role="button" @click="save_profile">Save profile</view><view class="history-link" role="button" @click="view = 'profile'">Cancel</view></template>
      <template v-else-if="view === 'coins'">
        <view class="wallet-card"><text class="cimoa-eyebrow">Your balance</text><text class="wallet-card__balance">{{ current_user.coin_balance }}</text><text class="wallet-card__label">coins</text></view><text class="cimoa-section-title section-title">Choose a coin pack</text><view v-for="pack in store.coin_packages" :key="pack.package_id" class="pack-card cimoa-card" role="button" @click="purchase(pack.package_id)"><image class="pack-card__image" :src="pack.image_url" mode="aspectFit" /><view class="pack-card__copy"><text class="pack-card__coins">{{ pack.coins }} coins</text><text v-if="pack.badge" class="pack-card__badge">{{ pack.badge }}</text></view><text class="pack-card__price">{{ pack.price }}</text></view><view class="history-link" role="button" @click="notice = 'Your recharge and spending history is up to date.'">View transaction history</view><text v-if="notice" class="notice">{{ notice }}</text>
      </template>
      <template v-else>
        <text class="cimoa-section-title section-title">Settings</text><view class="setting-card cimoa-card"><view class="setting-row"><view><text class="setting-row__title">Notifications</text><text class="setting-row__meta">Event reminders and connection updates</text></view><switch :checked="store.settings.notifications_enabled" :color="switch_color" @change="toggle_setting('notifications_enabled')" /></view><view class="setting-row"><view><text class="setting-row__title">Show online status</text><text class="setting-row__meta">Let mutual connections see when you are active</text></view><switch :checked="store.settings.show_online_status" :color="switch_color" @change="toggle_setting('show_online_status')" /></view><view class="setting-row"><view><text class="setting-row__title">Location access</text><text class="setting-row__meta">Used to sort nearby people and events</text></view><switch :checked="store.settings.location_enabled" :color="switch_color" @change="toggle_setting('location_enabled')" /></view></view><view class="menu-item cimoa-card" role="button" @click="notice = 'Blocked accounts are managed from Safety actions.'"><view><text class="menu-item__title">Blocked accounts</text><text class="menu-item__meta">{{ store.blocked_user_ids.length }} blocked</text></view><text class="menu-item__action">Open</text></view><text v-if="notice" class="notice">{{ notice }}</text>
      </template>
    </scroll-view>
    <AppLoading :visible="is_loading" label="Waiting for App Store..." />
    <ConfirmDialog :visible="show_logout" title="Log out of Cimoa?" message="Your local profile and messages will remain on this device." confirm-label="Log out" @cancel="show_logout = false" @confirm="logout" />
  </view>
</template>

<style scoped>
.profile-page { padding-bottom: 148rpx; }
.sub-header { display: flex; align-items: center; justify-content: space-between; padding: 12rpx 32rpx 18rpx; }
.sub-header__title { color: var(--cimoa-title); font-size: 25rpx; font-weight: 700; }
.back-button { color: var(--cimoa-secondary); font-size: 22rpx; }
.back-placeholder { width: 48rpx; }
.profile-intro { text-align: center; }
.large-avatar { width: 190rpx; height: 190rpx; margin: 6rpx auto 18rpx; }
.profile-intro__name, .profile-intro__meta, .profile-intro__bio { display: block; }
.profile-intro__name { color: var(--cimoa-title); font-size: 34rpx; font-weight: 700; }
.profile-intro__meta { margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 21rpx; }
.profile-intro__bio { margin: 18rpx auto 0; max-width: 600rpx; color: var(--cimoa-secondary); font-size: 21rpx; line-height: 32rpx; }
.stats-row {
  display: flex;
  justify-content: space-around;
  margin: 34rpx 0;
  padding: 22rpx 0;
  border-top: 1px solid var(--cimoa-border);
  border-bottom: 1px solid var(--cimoa-border);
  text-align: center;
}
.stats-row__value, .stats-row__label { display: block; }
.stats-row__value { color: var(--cimoa-title); font-size: 28rpx; font-weight: 700; }
.stats-row__label { margin-top: 6rpx; color: var(--cimoa-secondary); font-size: 18rpx; }
.menu-list { display: flex; flex-direction: column; gap: 12rpx; }
.menu-item { display: flex; align-items: center; justify-content: space-between; padding: 22rpx; }
.menu-item.cimoa-card { margin-top: 16rpx; }
.menu-item__title, .menu-item__meta { display: block; }
.menu-item__title { color: var(--cimoa-title); font-size: 23rpx; font-weight: 700; }
.menu-item__meta { margin-top: 6rpx; color: var(--cimoa-secondary); font-size: 18rpx; }
.menu-item__action { color: var(--cimoa-success); font-size: 19rpx; }
.profile-actions { display: flex; gap: 14rpx; margin-top: 24rpx; }
.profile-actions > view { flex: 1; min-height: 76rpx; }
.edit-input {
  display: block;
  width: 100%;
  height: 82rpx;
  margin-bottom: 16rpx;
  padding: 0 20rpx;
  border: 1px solid var(--cimoa-outline);
  border-radius: 18rpx;
  color: var(--cimoa-title);
  background: var(--cimoa-card);
  font-size: 22rpx;
}
.edit-textarea {
  display: block;
  width: 100%;
  height: 180rpx;
  margin-bottom: 20rpx;
  padding: 18rpx;
  border: 1px solid var(--cimoa-outline);
  border-radius: 18rpx;
  color: var(--cimoa-title);
  background: var(--cimoa-card);
  font-size: 22rpx;
}
.wallet-card { padding: 28rpx; border-radius: 28rpx; background: var(--cimoa-deep); color: var(--cimoa-card); }
.wallet-card__balance { display: block; margin-top: 16rpx; color: var(--cimoa-primary); font-size: 66rpx; font-weight: 700; }
.wallet-card__label { display: block; margin-top: -8rpx; color: var(--cimoa-tertiary); font-size: 20rpx; }
.section-title { margin: 34rpx 0 18rpx; }
.pack-card { display: flex; align-items: center; margin-bottom: 14rpx; padding: 16rpx; }
.pack-card__image { width: 82rpx; height: 82rpx; }
.pack-card__copy { flex: 1; margin-left: 14rpx; }
.pack-card__coins, .pack-card__badge { display: block; }
.pack-card__coins { color: var(--cimoa-title); font-size: 24rpx; font-weight: 700; }
.pack-card__badge {
  display: inline-block;
  margin-top: 6rpx;
  padding: 4rpx 10rpx;
  border-radius: 100rpx;
  background: var(--cimoa-lavender);
  color: var(--cimoa-title);
  font-size: 16rpx;
}
.pack-card__price { color: var(--cimoa-success); font-size: 22rpx; font-weight: 700; }
.history-link { margin-top: 24rpx; color: var(--cimoa-secondary); font-size: 21rpx; text-align: center; }
.setting-card { margin-top: 22rpx; padding: 0 22rpx; }
.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 0; border-bottom: 1px solid var(--cimoa-border); }
.setting-row:last-child { border-bottom: 0; }
.setting-row > view { flex: 1; }
.setting-row__title, .setting-row__meta { display: block; }
.setting-row__title { color: var(--cimoa-title); font-size: 22rpx; font-weight: 700; }
.setting-row__meta { margin-top: 6rpx; color: var(--cimoa-secondary); font-size: 18rpx; line-height: 26rpx; }
.notice {
  display: block;
  margin-top: 22rpx;
  color: var(--cimoa-success);
  font-size: 19rpx;
  line-height: 28rpx;
  text-align: center;
}
</style>
