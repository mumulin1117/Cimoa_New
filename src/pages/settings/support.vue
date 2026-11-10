<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_account_scope } from '@/composables/useAccountScope.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'

const store = use_app_store()
const frame = ref(null)
const open_faq = ref(-1)
const form_open = ref(false)
const topic = ref('')
const description = ref('')
const context_type = ref('general')
const context_id = ref('general')
const draft_id = ref('')
const error = ref('')
const delivery_notice = ref('')
const account_id = store.session.account_id
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
let active = true

const topics = ['Safety concern', 'Account or profile', 'Technical issue', 'Purchase question', 'Other']
const faqs = [
  ['How can I contact support?', 'Choose a topic in the support form and describe your concern. If your message cannot be sent, it remains available for you to edit and try again.'],
  ['Where can I view my reports?', 'Open Submitted Reports in Settings to review your report history and the available delivery status.'],
  ['How do I reset my password?', 'Choose Forgot password on the login screen, enter your account email, then enter your reset code to choose a new password.'],
  ['Can Cimoa change iOS permissions?', 'No. Cimoa can check the current status and open iOS Settings, but only you can grant or deny system permissions.'],
  ['What happens when I block someone?', 'Blocking removes the current connection, requests, Auto Match candidate, private chat and its messages. Unblocking does not restore them.'],
  ['How do coin purchases work?', 'Choose a package in Coins & Purchases to check current App Store pricing and availability. Coins are added only after verification. Failed or cancelled attempts do not change your balance.'],
  ['What should I include in my message?', 'Choose the topic that best matches your concern. Describe what happened, what you expected and any steps that may help us understand the issue. Do not include your password or payment details.'],
]
const draft_target = computed(() => context_type.value === 'report' && context_id.value ? `report:${context_id.value}` : 'general')
const account_scope = use_account_scope(store, () => { cancel_loading(); topic.value = ''; description.value = ''; form_open.value = false; draft_id.value = '' })
const access_error = computed(() => store.hydration_status !== 'ready'
  ? 'Your data is unavailable. Please return and retry.'
  : !store.session.is_authenticated || store.session.account_id !== account_id || !account_scope.is_current()
    ? 'Your session has ended or the account changed. Return to account entry.'
    : '')
const ready = computed(() => !!topic.value && !!description.value.trim())

const restore_draft = () => {
  if (access_error.value) return
  const row = store.current_drafts.find(item => item.kind === 'support' && item.target_id === draft_target.value)
  if (!row) return
  draft_id.value = row.draft_id
  topic.value = topics.includes(row.payload?.topic) ? row.payload.topic : ''
  description.value = String(row.payload?.description || '')
  form_open.value = true
  delivery_notice.value = 'Continue editing your message. It has not been sent.'
}
onLoad(options => {
  context_type.value = options?.context_type === 'report' ? 'report' : 'general'
  context_id.value = context_type.value === 'report' ? String(options?.context_id || '') : 'general'
  restore_draft()
})
const leave = () => { active = false; cancel_loading() }
onShow(() => { active = true; restore_draft() })
onHide(leave)
onUnmounted(leave)

const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const back = async () => { if (is_loading.value) return; try { await frame.value.navigate_back('/pages/settings/index') } catch (cause) { error.value = cause.message } }
const toggle_faq = index => { if (!is_loading.value) open_faq.value = open_faq.value === index ? -1 : index }
const open_form = () => { if (is_loading.value || access_error.value) return; error.value = ''; delivery_notice.value = ''; form_open.value = true }
const save_draft = async () => {
  if (!active || is_loading.value || access_error.value || !ready.value) { if (!ready.value) error.value = 'Choose a topic and add a description to continue.'; return }
  error.value = ''; delivery_notice.value = ''
  let saved_id = ''
  const result = await run_with_loading(() => {
    const saved = store.save_draft('support', draft_target.value, { topic: topic.value, description: description.value.trim(), context_type: context_type.value, context_id: context_id.value || null })
    if (!saved.success) return saved
    saved_id = saved.data
    const delivery = store.submit_support({ draft_id: saved.data })
    return { ...delivery, saved_draft_id: saved.data }
  })
  if (!active || result.reason === 'cancelled') return
  if (saved_id) {
    draft_id.value = saved_id
    delivery_notice.value = 'Your message has not been sent. It is still available to edit. Please try again later.'
    return
  }
  error.value = result.message || 'Your message couldn’t be prepared. Please try again.'
}
</script>

<template>
  <ProfileEditorFrame ref="frame" class="settings-support-page" title="Help and support" source="setSupport" :busy="is_loading" loading-label="Sending your message…" :error="error" @dismiss-error="error = String()" :access-error="access_error" @back="back" @recover="recover">
    <template v-if="!form_open">
      <view class="support-faqs">
        <view v-for="(item, index) in faqs" :key="item[0]" class="support-faq">
          <view class="support-faq-header" role="button" tabindex="0" :aria-expanded="open_faq === index" data-interaction="setSupport.h.toggle.click.1" @click="toggle_faq(index)" @keydown.enter="toggle_faq(index)"><text>{{ item[0] }}</text><view class="support-chevron" :class="{ open: open_faq === index }"><SourceIcon name="chevron" /></view></view>
          <text v-if="open_faq === index" class="support-answer">{{ item[1] }}</text>
        </view>
      </view>
      <view class="support-primary" role="button" tabindex="0" data-interaction="setSupport.openSupportForm.click.1" @click="open_form" @keydown.enter="open_form">Contact Support</view>
    </template>
    <template v-else>
      <text class="support-form-note">Choose a topic and tell us how we can help. Do not include your password or payment details.</text>
      <text class="editor-label">Topic</text>
      <view class="support-topics" role="radiogroup" aria-label="Support topic"><view v-for="item in topics" :key="item" class="support-topic" :class="{ selected: topic === item }" role="radio" tabindex="0" :aria-checked="topic === item" @click="topic = item; error = ''; delivery_notice = ''" @keydown.enter="topic = item; error = ''; delivery_notice = ''">{{ item }}</view></view>
      <text class="editor-label">Description</text>
      <textarea v-model="description" class="support-description" aria-label="Support description" placeholder="Describe what happened and what you expected" :maxlength="2000" :disabled="is_loading" @input="delivery_notice = ''" />
      <text class="support-attachment-note">Screenshot attachments are currently unavailable.</text>
      <text v-if="delivery_notice" class="support-delivery" role="status">{{ delivery_notice }}</text>
      <view class="support-primary" role="button" tabindex="0" :aria-disabled="!ready || is_loading" data-interaction="setSupport.submitDraft.click.1" @click="save_draft" @keydown.enter="save_draft">Send message</view>
      <view class="support-secondary" role="button" tabindex="0" :aria-disabled="is_loading" data-interaction="setSupport.closeSupportForm.click.1" @click="!is_loading && (form_open = false)" @keydown.enter="!is_loading && (form_open = false)">Back to help topics</view>
    </template>
  </ProfileEditorFrame>
</template>

<style scoped>
.support-faqs { display: flex; flex-direction: column; gap: 19.084rpx; }
.support-faq { padding: 30.534rpx 34.351rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.support-faq-header { display: flex; align-items: center; gap: 22.901rpx; cursor: pointer; }
.support-faq-header > text { flex: 1; min-width: 0; font-size: 32.443rpx; font-weight: 700; line-height: 1.35; }
.support-chevron { flex: none; width: 30.534rpx; height: 30.534rpx; color: var(--cimoa-text-profile-chevron); transform: rotate(90deg); transition: transform 180ms ease; }
.support-chevron.open { transform: rotate(-90deg); }
.support-answer { display: block; margin-top: 19.084rpx; color: var(--cimoa-text-profile-bio); font-size: 30.534rpx; line-height: 1.5; }
.support-primary, .support-secondary { display: flex; align-items: center; justify-content: center; min-height: 110.687rpx; margin-top: 30.534rpx; padding: 19.084rpx; border-radius: 55.344rpx; font-size: 34.351rpx; font-weight: 700; text-align: center; cursor: pointer; }
.support-primary { background: var(--cimoa-gradient-primary); color: var(--cimoa-text-inverse); box-shadow: var(--cimoa-shadow-event-confirm); }
.support-secondary { margin-top: 19.084rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-secondary); }
.support-form-note { display: block; color: var(--cimoa-text-secondary); font-size: 28.626rpx; line-height: 1.5; }
.support-topics { display: flex; flex-wrap: wrap; gap: 15.267rpx; }
.support-topic { min-height: 76.336rpx; padding: 17.176rpx 26.718rpx; border: 2px solid var(--cimoa-surface-onboarding-border); border-radius: 38.168rpx; background: var(--cimoa-surface-card); color: var(--cimoa-text-secondary); font-size: 28.626rpx; font-weight: 600; cursor: pointer; }
.support-topic.selected { border-color: var(--cimoa-button-primary); color: var(--cimoa-text-title); font-weight: 700; }
.support-description { display: block; width: 100%; min-height: 267.176rpx; padding: 30.534rpx 34.351rpx; border-radius: 38.168rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-auth-input); color: var(--cimoa-text-title); font-size: 30.534rpx; line-height: 1.45; }
.support-attachment-note { display: block; margin-top: 19.084rpx; color: var(--cimoa-text-auth-placeholder); font-size: 26.718rpx; line-height: 1.4; }
.support-delivery { display: block; margin-top: 22.901rpx; padding: 26.718rpx; border-radius: 30.534rpx; background: var(--cimoa-surface-verification-pill); color: var(--cimoa-text-verification-pill); font-size: 28.626rpx; line-height: 1.45; }
.support-draft-id { display: block; margin-top: 9.542rpx; font-size: 22.901rpx; overflow-wrap: anywhere; }
.settings-support-page [aria-disabled='true'] { opacity: 0.55; cursor: default; }
</style>
