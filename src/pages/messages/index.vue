<script setup>
import { computed, nextTick, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { back_route, push_route } from '@/utils/routeTransition.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import AppLoading from '@/components/AppLoading.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = use_app_store()
const view = ref('list')
const user_id = ref('user_maya')
const event_id = ref('event_picnic')
const message_draft = ref('')
const show_safety = ref(false)
const call_state = ref('incoming')
const scroll_top = ref(0)
const notice = ref('')
const { is_loading, run_with_loading } = use_write_loading()
const conversation = computed(() => store.conversations.find((item) => item.participant_id === user_id.value))
const participant = computed(() => store.user_by_id(user_id.value))
const open_chat = (id) => { user_id.value = id; view.value = 'chat'; nextTick(() => { scroll_top.value = 99999 }) }
const send_message = async () => { const body = message_draft.value.trim(); if (!body) return; const result = await run_with_loading(() => store.send_message(conversation.value?.conversation_id, body)); if (result.success) { message_draft.value = ''; scroll_top.value += 500; notice.value = 'Sent' } }
const start_call = () => { view.value = 'call'; call_state.value = 'incoming' }
const accept_call = () => { call_state.value = 'active' }
const end_call = () => { call_state.value = 'ended' }
const confirm_block = async () => { show_safety.value = false; await run_with_loading(() => store.block_user(user_id.value)); view.value = 'list'; notice.value = 'Account blocked.' }
onLoad((options) => { if (options?.view) view.value = options.view; if (options?.user_id) user_id.value = options.user_id; if (options?.event_id) event_id.value = options.event_id })
</script>

<template>
  <view class="cimoa-page messages-page">
    <TopSafeArea />
    <template v-if="view === 'list'">
      <view class="page-header"><view><text class="cimoa-eyebrow">Messages</text><text class="cimoa-title">Good conversations take time.</text></view></view>
      <scroll-view class="cimoa-scroll list-scroll" scroll-y :show-scrollbar="false"><view v-for="item in store.current_conversations" :key="item.conversation_id" class="conversation cimoa-card" role="button" @click="open_chat(item.participant_id)"><image class="conversation__avatar" :src="store.user_by_id(item.participant_id)?.avatar_url" mode="aspectFill" /><view class="conversation__body"><view class="conversation__heading"><text class="conversation__name">{{ store.user_by_id(item.participant_id)?.user_name }}</text><text class="conversation__time">{{ item.messages[item.messages.length - 1]?.sent_at }}</text></view><text class="conversation__preview">{{ item.messages[item.messages.length - 1]?.body }}</text></view><view v-if="item.unread_count" class="unread">{{ item.unread_count }}</view></view><view class="call-banner cimoa-card" role="button" @click="open_chat('user_maya')"><text class="cimoa-eyebrow">Incoming call</text><text class="call-banner__title">Maya is ready to talk.</text><text class="call-banner__meta">Tap to answer or call back.</text></view></scroll-view>
    </template>
    <template v-else-if="view === 'chat'">
      <view class="chat-header"><view class="back-button" role="button" @click="view = 'list'">Back</view><view class="chat-header__person"><image class="chat-header__avatar" :src="participant?.avatar_url" mode="aspectFill" /><view><text class="chat-header__name">{{ participant?.user_name }}</text><text class="chat-header__status">{{ participant?.online ? 'Online now' : 'Recently active' }}</text></view></view><view class="chat-header__call" role="button" @click="start_call">Call</view></view>
      <scroll-view class="chat-scroll" scroll-y :scroll-top="scroll_top" :show-scrollbar="false"><view v-for="message in conversation?.messages" :key="message.message_id" class="message-row" :class="{ mine: message.sender_id === store.current_user.user_id }"><text class="message-bubble">{{ message.body }}</text><text class="message-time">{{ message.sent_at }}</text></view><text v-if="notice" class="notice">{{ notice }}</text></scroll-view>
      <view class="composer"><textarea v-model="message_draft" class="composer__input" placeholder="Write a message" :maxlength="500" /><view class="composer__send" role="button" @click="send_message">Send</view><view class="composer__safety" role="button" @click="show_safety = true">Safety</view></view>
    </template>
    <template v-else>
      <view class="call-page"><image class="call-page__avatar" :src="participant?.avatar_url" mode="aspectFill" /><text class="call-page__name">{{ participant?.user_name }}</text><text class="call-page__state">{{ call_state === 'incoming' ? 'Incoming video call' : call_state === 'active' ? 'Connected' : 'Call ended' }}</text><view class="call-page__actions"><view v-if="call_state === 'incoming'" class="cimoa-button" role="button" @click="accept_call">Answer</view><view v-if="call_state !== 'ended'" class="cimoa-button danger" role="button" @click="end_call">End call</view><view v-if="call_state === 'ended'" class="cimoa-button ghost" role="button" @click="view = 'chat'">Return to chat</view></view></view>
    </template>
    <AppLoading :visible="is_loading" label="Sending..." />
    <ConfirmDialog :visible="show_safety" title="Safety actions" message="You can block this account and report the conversation." confirm-label="Block account" danger @cancel="show_safety = false" @confirm="confirm_block" />
  </view>
</template>

<style scoped>
.messages-page { min-height: 100vh; }.page-header { padding: 24rpx 32rpx 0; }.list-scroll { height: calc(100vh - 190rpx); }.conversation { display: flex; align-items: center; margin: 0 32rpx 14rpx; padding: 20rpx; }.conversation__avatar, .chat-header__avatar { width: 74rpx; height: 74rpx; border-radius: 50%; }.conversation__body { flex: 1; min-width: 0; margin-left: 16rpx; }.conversation__heading { display: flex; justify-content: space-between; }.conversation__name { color: var(--cimoa-title); font-size: 24rpx; font-weight: 700; }.conversation__time { color: var(--cimoa-tertiary); font-size: 17rpx; }.conversation__preview { display: block; overflow: hidden; margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }.unread { width: 34rpx; height: 34rpx; border-radius: 50%; background: var(--cimoa-primary); color: var(--cimoa-primary-text); font-size: 18rpx; line-height: 34rpx; text-align: center; }.call-banner { margin: 26rpx 32rpx; padding: 24rpx; }.call-banner__title, .call-banner__meta { display: block; }.call-banner__title { margin-top: 10rpx; color: var(--cimoa-title); font-size: 26rpx; font-weight: 700; }.call-banner__meta { margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 20rpx; }.chat-header { display: flex; align-items: center; padding: 14rpx 32rpx 18rpx; }.back-button, .chat-header__call { color: var(--cimoa-secondary); font-size: 21rpx; }.chat-header__person { display: flex; flex: 1; align-items: center; justify-content: center; gap: 12rpx; }.chat-header__name, .chat-header__status { display: block; text-align: center; }.chat-header__name { color: var(--cimoa-title); font-size: 23rpx; font-weight: 700; }.chat-header__status { margin-top: 4rpx; color: var(--cimoa-success); font-size: 17rpx; }.chat-header__avatar { width: 54rpx; height: 54rpx; }.chat-scroll { height: calc(100vh - 270rpx); padding: 20rpx 32rpx 130rpx; }.message-row { display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 18rpx; }.message-row.mine { align-items: flex-end; }.message-bubble { max-width: 78%; padding: 16rpx 20rpx; border-radius: 22rpx 22rpx 22rpx 6rpx; background: var(--cimoa-card); color: var(--cimoa-title); font-size: 22rpx; line-height: 32rpx; }.message-row.mine .message-bubble { border-radius: 22rpx 22rpx 6rpx 22rpx; background: var(--cimoa-deep); color: var(--cimoa-card); }.message-time { margin-top: 6rpx; color: var(--cimoa-tertiary); font-size: 16rpx; }.composer { position: fixed; left: 0; right: 0; bottom: 0; z-index: 15; display: flex; align-items: flex-end; gap: 10rpx; padding: 16rpx 24rpx max(env(safe-area-inset-bottom, 0px), var(--native-safe-area-bottom, 0px)); border-top: 1px solid var(--cimoa-border); background: var(--cimoa-page); }.composer__input { flex: 1; height: 72rpx; padding: 16rpx; border: 1px solid var(--cimoa-outline); border-radius: 20rpx; background: var(--cimoa-card); color: var(--cimoa-title); font-size: 21rpx; }.composer__send, .composer__safety { padding: 18rpx 12rpx; color: var(--cimoa-success); font-size: 19rpx; font-weight: 700; }.composer__safety { color: var(--cimoa-secondary); }.call-page { display: flex; flex-direction: column; align-items: center; padding: 160rpx 32rpx 0; }.call-page__avatar { width: 240rpx; height: 240rpx; border-radius: 50%; }.call-page__name { margin-top: 28rpx; color: var(--cimoa-title); font-size: 34rpx; font-weight: 700; }.call-page__state { margin-top: 10rpx; color: var(--cimoa-secondary); font-size: 21rpx; }.call-page__actions { display: flex; gap: 14rpx; width: 100%; margin-top: 50rpx; }.call-page__actions > view { flex: 1; }.notice { display: block; margin-top: 14rpx; color: var(--cimoa-success); font-size: 18rpx; text-align: center; }
</style>
