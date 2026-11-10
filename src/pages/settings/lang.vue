<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import { locale, locale_label, t } from '@/i18n/index.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const notice = ref('')
const account_id = store.session.account_id
const options = computed(() => [{ value: 'en-US', label: locale_label('en-US') }, { value: 'fr-FR', label: locale_label('fr-FR') }])
const language = computed(() => locale.value)
const { is_loading, run_with_loading } = use_write_loading()
const account_scope = use_account_scope(store)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const select = async value => {
  if (access_error.value || is_loading.value || language.value === value) return
  error.value = ''; notice.value = ''
  const result = await run_with_loading(() => store.set_language(value))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  notice.value = 'Language updated'
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-language-page" title="Language" source="setLang" :busy="is_loading" loading-label="Updating preferences…" :error="error" @dismiss-error="error = String()" :access-error="access_error" @back="back" @recover="recover">
    <FeedbackToast v-if="notice" :message="notice" tone="info" @dismiss="notice = String()" />
    <view class="settings-page-stack language-stack" role="radiogroup" aria-label="App language">
      <view v-for="option in options" :key="option.value" class="settings-page-choice language-choice" :class="{ selected: language === option.value }" role="radio" tabindex="0" :aria-checked="language === option.value" data-interaction="setLang.o.pick.click.1" @click="select(option.value)" @keydown.enter="select(option.value)">
        <text>{{ option.label }}</text>
        <view v-if="language === option.value" class="language-check"><SourceIcon name="check" :stroke-width="2.8" /></view>
      </view>
    </view>
    <text class="settings-page-note">English and French are available. Your choice applies immediately and is kept for this installation.</text>
  </ProfileEditorFrame>
</template>

<style>
@import './settings-pages.css';
</style>
<style scoped>
.language-stack { margin-top: 0; }
.language-choice { gap: 22.901rpx; min-height: 0; padding: 34.351rpx; font-size: 34.351rpx; font-weight: 700; }
.language-choice > text { flex: 1; }
.language-check { width: 38.168rpx; height: 38.168rpx; color: var(--cimoa-button-primary); }
.language-notice { display: block; margin-bottom: 22.901rpx; color: var(--cimoa-status-success); font-size: 28.626rpx; line-height: 1.4; }
</style>
