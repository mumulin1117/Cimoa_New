<script setup>
import { computed, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { require_profile_destination_ready } from '@/utils/profileNavigation.js'
import { SETTINGS_GROUPS } from '@/utils/settingsNavigation.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import AgreementSheet from '@/components/AgreementSheet.vue'
import LogoutConfirmDialog from '@/components/LogoutConfirmDialog.vue'
const store = use_app_store(), frame = ref(null), account_id = store.session.account_id
const user = computed(() => store.current_user), error = ref(''), logout_error = ref(''), logout_open = ref(false), document = ref(null), navigating = ref(false)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let logout_committed = false
const access_error = computed(() => store.hydration_status !== 'ready' ? 'Saved data is unavailable. Please return and retry.' : !store.session.is_authenticated || store.session.account_id !== account_id ? 'Your session has ended or the account changed. Return to account entry.' : '')
watch(access_error, value => { if (value && !logout_committed) { cancel_loading(); logout_open.value = false; document.value = null } })
onHide(() => { cancel_loading(); logout_open.value = false; document.value = null })
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const navigate = async route => {
  if (is_loading.value || navigating.value) return
  error.value = ''; navigating.value = true
  try { if (route) { if (access_error.value) throw Error(access_error.value); await frame.value.navigate_forward(require_profile_destination_ready(route)) } else await frame.value.navigate_back('/pages/profile/index') } catch (cause) { error.value = cause.message } finally { navigating.value = false }
}
const open_row = row => { if (row.route) navigate(row.route); else if (!access_error.value) document.value = store.registration_catalog.agreements.find(item => item.key === 'community') }
const open_logout = () => { if (is_loading.value || access_error.value) return; error.value = ''; logout_error.value = ''; logout_open.value = true }
const logout = async () => {
  if (is_loading.value || !logout_open.value || access_error.value) return
  logout_error.value = ''
  const result = await run_with_loading(() => { const result = store.logout(account_id); logout_committed = result.success; return result })
  if (result.reason === 'cancelled') return
  if (!result.success) { logout_error.value = result.message; return }
  logout_open.value = false
  try { await relaunch_route('/pages/auth/welcome') } catch (cause) { error.value = cause.message }
}
</script>
<template>
  <ProfileEditorFrame ref="frame" class="settings-page" title="Settings" source="settings" :busy="is_loading" loading-label="Logging out…" :error="error" :access-error="access_error" @back="navigate()" @recover="recover">
    <text class="settings-label">Account</text><view class="settings-card"><view class="settings-row account-row" role="button" data-interaction="settings.openEditBasic.click.1" @click="navigate('/pages/profile/edit')"><view class="settings-avatar"><ProfilePhoto :src="user.avatar_url" :name="user.user_name" portrait /></view><view class="account-text"><text>Account</text><view><view v-if="user.verified" class="settings-verified"><SourceIcon name="verified" /></view><text>{{ user.verified ? 'University verified' : 'Local account · not student verified' }}</text></view></view><view class="settings-chevron"><SourceIcon name="chevron" /></view></view><view class="settings-row" role="button" data-interaction="settings.openStore.click.1" @click="navigate('/pages/coins/index')"><image class="settings-coin" src="/static/assets/coins/home-coin-badge.png" mode="aspectFit" /><text>Coins &amp; Purchases</text><text class="settings-value">{{ store.coin_balance.toLocaleString('en-US') }}</text><view class="settings-chevron"><SourceIcon name="chevron" /></view></view></view>
    <template v-for="group in SETTINGS_GROUPS" :key="group.title"><text class="settings-label">{{ group.title }}</text><view class="settings-card"><view v-for="row in group.rows" :key="row.action" class="settings-row" role="button" :data-interaction="`settings.${row.action}.click.1`" @click="open_row(row)"><view class="settings-icon" :class="row.tone"><SourceIcon :name="row.icon" :stroke-width="1.9" /></view><text>{{ row.label }}</text><text v-if="row.action === 'openSetLang'" class="settings-value">{{ store.current_settings.language === 'en-US' ? 'English' : store.current_settings.language }}</text><view class="settings-chevron"><SourceIcon name="chevron" /></view></view></view></template>
    <view class="settings-row logout-row" role="button" data-interaction="settings.openLogoutConfirm.click.1" @click="open_logout"><view class="settings-action-icon"><SourceIcon name="logout" /></view><text>Log Out</text><view class="settings-chevron"><SourceIcon name="chevron" /></view></view>
    <view class="settings-row delete-row" role="button" data-interaction="settings.openDelInfo.click.1" @click="navigate('/pages/settings/delete/info')"><view class="settings-action-icon"><SourceIcon name="delete" /></view><text>Delete Account</text><view class="settings-chevron"><SourceIcon name="chevron" /></view></view>
    <template #overlays><AgreementSheet :open="!!document" :document="document" @close="document = null" /><LogoutConfirmDialog :open="logout_open" :busy="is_loading" :error="logout_error" @close="logout_open = false" @confirm="logout" /></template>
  </ProfileEditorFrame>
</template>
<style scoped>
.settings-label { display: block; font-size: 28.626rpx; color: var(--cimoa-text-auth-placeholder); margin: 41.985rpx 0 19.084rpx; }
.settings-label:first-child { margin-top: 38.168rpx; }
.settings-card { padding: 0 34.351rpx; background: var(--cimoa-surface-card); border-radius: 45.802rpx; box-shadow: var(--cimoa-shadow-card); }
.settings-row { display: flex; align-items: center; gap: 22.901rpx; min-height: 114.504rpx; cursor: pointer; }
.settings-card .settings-row + .settings-row { border-top: 1px solid var(--cimoa-surface-event-divider); }
.settings-row > text { flex: 1; min-width: 0; font-size: 32.443rpx; font-weight: 600; }
.settings-row > .settings-value { flex: none; max-width: 30%; color: var(--cimoa-text-auth-placeholder); font-size: 28.626rpx; font-weight: 400; }
.settings-chevron { flex: none; width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-text-profile-chevron); }
.settings-icon { flex: none; width: 80.153rpx; height: 80.153rpx; padding: 18.13rpx; border-radius: 40.076rpx; }
.pink { background: var(--cimoa-surface-settings-pink); color: var(--cimoa-text-settings-pink); }
.purple { background: var(--cimoa-surface-settings-purple); color: var(--cimoa-text-settings-purple); }
.blue { background: var(--cimoa-surface-settings-blue); color: var(--cimoa-text-settings-blue); }
.settings-coin { flex: none; width: 80.153rpx; height: 80.153rpx; }
.account-row { min-height: 125.954rpx; }
.settings-avatar {
  position: relative;
  flex: none;
  width: 76.336rpx;
  height: 76.336rpx;
  border-radius: 38.168rpx;
  overflow: hidden;
}
.account-text { flex: 1; min-width: 0; font-size: 32.443rpx; font-weight: 600; }
.account-text > view {
  display: flex;
  align-items: center;
  gap: 9.542rpx;
  margin-top: 3.817rpx;
  color: var(--cimoa-text-auth-placeholder);
  font-size: 26.718rpx;
  font-weight: 400;
}
.settings-verified { width: 26.718rpx; height: 26.718rpx; flex: none; }
.settings-action-icon { width: 43.893rpx; height: 43.893rpx; flex: none; }
.logout-row, .delete-row { padding: 15.267rpx 34.351rpx; border-radius: 45.802rpx; margin-top: 41.985rpx; background: var(--cimoa-surface-deep); color: var(--cimoa-text-inverse); }
.logout-row .settings-chevron, .delete-row .settings-chevron { color: inherit; }
.logout-row > text, .delete-row > text { font-weight: 700; }
.delete-row { margin-top: 19.084rpx; background: var(--cimoa-surface-settings-danger); color: var(--cimoa-text-settings-danger); }
</style>
