<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { push_route } from '@/utils/routeTransition.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import CustomTabBar from '@/components/CustomTabBar.vue'
import AppLoading from '@/components/AppLoading.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = use_app_store()
const view = ref('list')
const event_id = ref('event_picnic')
const filter = ref('All')
const show_cancel = ref(false)
const notice = ref('')
const { is_loading, run_with_loading } = use_write_loading()
const selected_event = computed(() => store.events.find((item) => item.event_id === event_id.value))
const filters = ['All', 'Social', 'Outdoors', 'Study', 'Music']
const filtered_events = computed(() => filter.value === 'All' ? store.events : store.events.filter((item) => item.category === filter.value))
const open_detail = (id) => { event_id.value = id; view.value = 'detail' }
const join_event = async () => { const result = await run_with_loading(() => store.join_event(event_id.value)); if (result.success) notice.value = 'You are on the list.' }
const cancel_event = async () => { show_cancel.value = false; const result = await run_with_loading(() => store.cancel_event(event_id.value)); if (result.success) notice.value = 'Attendance cancelled.' }
const open_chat = () => push_route(`/pages/messages/index?view=group&event_id=${event_id.value}`)
onLoad((options) => { if (options?.view) view.value = options.view; if (options?.event_id) event_id.value = options.event_id })
</script>

<template>
  <view class="cimoa-page events-page">
    <TopSafeArea />
    <view v-if="view !== 'list'" class="sub-header"><view class="back-button" role="button" @click="view = 'list'">Back</view><text class="sub-header__title">{{ view === 'detail' ? 'Event details' : view === 'participants' ? 'Participants' : 'My events' }}</text><view class="sub-header__space" /></view>
    <scroll-view class="cimoa-scroll" scroll-y :show-scrollbar="false">
      <template v-if="view === 'list'">
        <view class="cimoa-header"><view><text class="cimoa-eyebrow">Events</text><text class="cimoa-title">Plans worth leaving home for.</text></view><view class="calendar-button" role="button" @click="view = 'upcoming'">My events</view></view>
        <scroll-view class="filter-row" scroll-x :show-scrollbar="false"><view v-for="item in filters" :key="item" class="filter-chip" :class="{ active: filter === item }" role="button" @click="filter = item">{{ item }}</view></scroll-view>
        <view v-for="event in filtered_events" :key="event.event_id" class="event-tile cimoa-card" role="button" @click="open_detail(event.event_id)"><image class="event-tile__image" :src="event.image_url" mode="aspectFill" /><view class="event-tile__body"><text class="event-tile__category">{{ event.category }}</text><text class="event-tile__title">{{ event.title }}</text><text class="event-tile__meta">{{ event.date_label }} · {{ event.location }}</text><text class="event-tile__participants">{{ event.participant_count }} people joining</text></view></view>
      </template>
      <template v-else-if="view === 'detail'">
        <image class="detail-image" :src="selected_event?.image_url" mode="aspectFill" /><text class="detail-category">{{ selected_event?.category }}</text><text class="detail-title">{{ selected_event?.title }}</text><text class="detail-meta">{{ selected_event?.date_label }} · {{ selected_event?.location }}</text><text class="detail-description">{{ selected_event?.description }}</text><view class="detail-actions"><view v-if="!selected_event?.joined" class="cimoa-button" role="button" @click="join_event">Join event</view><view v-else class="cimoa-button ghost" role="button" @click="show_cancel = true">Cancel attendance</view><view class="cimoa-button ghost" role="button" @click="view = 'participants'">Participants</view></view><view class="group-card cimoa-card" role="button" @click="open_chat"><text class="cimoa-eyebrow">Group chat</text><text class="group-card__title">Say hello before you arrive.</text><text class="group-card__meta">{{ selected_event?.participant_count }} people in the room</text></view><text v-if="notice" class="notice">{{ notice }}</text>
      </template>
      <template v-else-if="view === 'participants'">
        <view class="participant-list"><view v-for="person in store.visible_people.slice(0, 4)" :key="person.user_id" class="participant"><image class="participant__avatar" :src="person.avatar_url" mode="aspectFill" /><view><text class="participant__name">{{ person.user_name }}</text><text class="participant__meta">{{ person.major }}</text></view><text class="participant__status">{{ person.online ? 'Online' : 'Joined' }}</text></view></view>
      </template>
      <template v-else>
        <view v-for="event in store.events.filter((item) => item.joined)" :key="event.event_id" class="upcoming-card cimoa-card" role="button" @click="open_detail(event.event_id)"><text class="cimoa-eyebrow">{{ event.date_label }}</text><text class="upcoming-card__title">{{ event.title }}</text><text class="upcoming-card__meta">{{ event.location }}</text></view><view v-if="!store.events.some((item) => item.joined)" class="empty-state">No upcoming events yet.</view>
      </template>
    </scroll-view>
    <CustomTabBar active="events" />
    <AppLoading :visible="is_loading" label="Updating attendance..." />
    <ConfirmDialog :visible="show_cancel" title="Cancel attendance?" message="You can join this event again later if spots remain." confirm-label="Cancel attendance" @cancel="show_cancel = false" @confirm="cancel_event" />
  </view>
</template>

<style scoped>
.events-page { padding-bottom: 148rpx; }.sub-header { display: flex; align-items: center; justify-content: space-between; padding: 12rpx 32rpx 18rpx; }.back-button, .calendar-button { color: var(--cimoa-secondary); font-size: 22rpx; }.sub-header__title { color: var(--cimoa-title); font-size: 25rpx; font-weight: 700; }.sub-header__space { width: 64rpx; }.filter-row { display: flex; margin: 0 -32rpx 22rpx; padding: 4rpx 32rpx 14rpx; white-space: nowrap; }.filter-chip { display: inline-flex; margin-right: 12rpx; padding: 14rpx 22rpx; border-radius: 100rpx; background: var(--cimoa-tinted); color: var(--cimoa-secondary); font-size: 20rpx; }.filter-chip.active { background: var(--cimoa-deep); color: var(--cimoa-card); }.event-tile { overflow: hidden; margin-bottom: 18rpx; }.event-tile__image { width: 100%; height: 245rpx; }.event-tile__body { padding: 22rpx; }.event-tile__category, .detail-category { color: var(--cimoa-success); font-size: 18rpx; font-weight: 700; text-transform: uppercase; }.event-tile__title { display: block; margin-top: 8rpx; color: var(--cimoa-title); font-size: 27rpx; font-weight: 700; }.event-tile__meta, .event-tile__participants { display: block; margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 19rpx; }.event-tile__participants { color: var(--cimoa-success); }.detail-image { width: 100%; height: 300rpx; border-radius: 28rpx; }.detail-category { display: block; margin-top: 24rpx; }.detail-title { display: block; margin-top: 8rpx; color: var(--cimoa-title); font-size: 36rpx; font-weight: 700; line-height: 46rpx; }.detail-meta, .detail-description { display: block; margin-top: 10rpx; color: var(--cimoa-secondary); font-size: 21rpx; line-height: 32rpx; }.detail-description { margin-top: 22rpx; color: var(--cimoa-title); }.detail-actions { display: flex; gap: 14rpx; margin-top: 28rpx; }.detail-actions > view { flex: 1; min-height: 76rpx; }.group-card { margin-top: 28rpx; padding: 24rpx; }.group-card__title, .group-card__meta { display: block; }.group-card__title { margin-top: 12rpx; color: var(--cimoa-title); font-size: 26rpx; font-weight: 700; }.group-card__meta { margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 20rpx; }.participant { display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1px solid var(--cimoa-border); }.participant__avatar { width: 68rpx; height: 68rpx; border-radius: 50%; }.participant > view { flex: 1; margin-left: 16rpx; }.participant__name, .participant__meta { display: block; }.participant__name { color: var(--cimoa-title); font-size: 23rpx; font-weight: 700; }.participant__meta { margin-top: 6rpx; color: var(--cimoa-secondary); font-size: 18rpx; }.participant__status { color: var(--cimoa-success); font-size: 18rpx; }.upcoming-card { margin-bottom: 16rpx; padding: 24rpx; }.upcoming-card__title, .upcoming-card__meta { display: block; }.upcoming-card__title { margin-top: 10rpx; color: var(--cimoa-title); font-size: 26rpx; font-weight: 700; }.upcoming-card__meta { margin-top: 6rpx; color: var(--cimoa-secondary); font-size: 20rpx; }.empty-state, .notice { margin-top: 34rpx; color: var(--cimoa-secondary); font-size: 22rpx; text-align: center; }.notice { color: var(--cimoa-success); }
</style>
