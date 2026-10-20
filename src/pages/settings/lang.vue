<script setup>
import { computed, ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const notice = ref('')
const account_id = store.session.account_id
const options = [{ value: 'en-US', label: 'English' }, { value: 'zh-Hant', label: '繁體中文' }]
const language = computed(() => store.current_settings.language || 'en-US')
const account_scope = use_account_scope(store)
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Saved data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const select = value => {
  if (access_error.value) return
  error.value = ''; notice.value = ''
  const result = store.set_language(value)
  if (!result.success) { error.value = result.message; return }
  notice.value = 'English is already selected.'
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-language-page" title="Language" source="setLang" :busy="false" :error="error" :access-error="access_error" @back="back" @recover="recover">
    <text v-if="notice" class="language-notice" role="status">{{ notice }}</text>
    <view class="settings-page-stack language-stack" role="radiogroup" aria-label="App language">
      <view v-for="option in options" :key="option.value" class="settings-page-choice language-choice" :class="{ selected: language === option.value }" role="radio" tabindex="0" :aria-checked="language === option.value" data-interaction="setLang.o.pick.click.1" @click="select(option.value)" @keydown.enter="select(option.value)">
        <text>{{ option.label }}</text>
        <view v-if="language === option.value" class="language-check"><SourceIcon name="check" :stroke-width="2.8" /></view>
      </view>
    </view>
    <text class="settings-page-note">English is currently available. More language options are not available yet.</text>
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
