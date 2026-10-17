<script setup>
import { computed, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { events_destination, require_events_destination_ready } from '@/utils/eventsNavigation.js'
import MainTabFrame from '@/components/MainTabFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import EvJoinConfirmDialog from '@/components/EvJoinConfirmDialog.vue'
import EvCancelConfirmDialog from '@/components/EvCancelConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), sheet = ref(''), selected_id = ref(''), sheet_locked = ref(false)
const feedback = ref(''), dialog_error = ref(''), loading_label = ref(''), navigating = ref(false)
const { is_loading, run_with_loading: run, cancel_loading: cancel } = use_write_loading()
const events = computed(() => store.event_feed)
const target = (kind, id) => { try { return events_destination(store, kind, id) } catch { return '' } }
const navigate = async (kind, id) => {
  if (navigating.value || is_loading.value) return
  navigating.value = true; feedback.value = ''; store.tick()
  try { await frame.value.navigate_forward(require_events_destination_ready(events_destination(store, kind, id))) }
  catch (error) { feedback.value = error.message }
  finally { navigating.value = false }
}
const close = () => { if (!is_loading.value) { sheet.value = ''; dialog_error.value = '' } }
const open = (kind, id) => {
  if (is_loading.value || sheet_locked.value) return
  store.tick(); feedback.value = ''; dialog_error.value = ''
  const event = store.event_by_id(id)
  if (kind === 'join' && event?.joined) { navigate('detail', id); return }
  const error = kind === 'join' ? store.event_join_blocker(id) : !event?.joined ? 'You have not joined this event.' : ''
  if (error) { feedback.value = error; return }
  selected_id.value = id; sheet.value = kind; sheet_locked.value = true
}
const write = async (label, action) => {
  const owner = store.session.current_user_id
  loading_label.value = label
  return run(() => store.session.current_user_id !== owner ? { success: false, message: 'The account changed. Please retry.' } : action())
}
const select_tab = async label => {
  if (is_loading.value || sheet_locked.value || store.active_event_tab === label) return
  feedback.value = ''
  const result = await write('Updating events…', () => store.select_event_tab(label))
  if (!result.success && result.reason !== 'cancelled') feedback.value = result.message
}
const submit = async () => {
  if (is_loading.value || !sheet.value) return
  const kind = sheet.value, id = selected_id.value
  dialog_error.value = ''
  const result = await write(kind === 'join' ? 'Joining event…' : 'Cancelling attendance…', () => kind === 'join' ? store.join_event(id) : store.leave_event(id))
  if (result.reason === 'cancelled') return
  if (!result.success) { dialog_error.value = result.message; return }
  close()
  if (kind === 'join') {
    try { await frame.value.navigate_forward(require_events_destination_ready(events_destination(store, 'join-success', id))) }
    catch (error) { feedback.value = `Your place is saved. ${error.message}` }
  } else feedback.value = 'Attendance cancelled. Your place is available again.'
}
const reset_transient = () => { cancel(); sheet.value = ''; sheet_locked.value = false; selected_id.value = ''; feedback.value = ''; dialog_error.value = '' }
onHide(reset_transient)
watch(() => store.session.current_user_id, reset_transient)
</script>

<template>
  <MainTabFrame ref="frame" route="pages/events/index" :scroll-locked="sheet_locked || is_loading">
    <template #header>
      <view class="events-header">
        <view class="events-toolbar">
          <view class="events-me" role="button" tabindex="0" aria-label="My profile" data-interaction="events.openMe.click.1" :data-target="target('profile')" @click="navigate('profile')" @keydown.enter="navigate('profile')"><view class="events-person-icon"><SourceIcon name="person" /></view></view>
          <view class="events-upcoming" role="button" tabindex="0" data-interaction="events.openMyEvents.click.1" :data-target="target('upcoming')" @click="navigate('upcoming')" @keydown.enter="navigate('upcoming')"><view class="events-icon"><SourceIcon name="my-events" /></view><text>My Events</text></view>
        </view>
        <text class="events-title">Campus events</text>
        <text class="events-subtitle">Meet around something you enjoy.</text>
        <view class="events-tabs">
          <view v-for="tab in store.event_tabs" :key="tab.label" class="events-chip" :class="{ 'events-chip--active': store.active_event_tab === tab.label }" role="button" tabindex="0" :aria-pressed="store.active_event_tab === tab.label" :aria-disabled="is_loading" :data-interaction="tab.interaction_id" @click="select_tab(tab.label)" @keydown.enter="select_tab(tab.label)">{{ tab.label }}</view>
        </view>
      </view>
    </template>
    <view v-if="store.hydration_status === 'error'" class="events-state" role="alert"><text>{{ store.hydration_error }}</text><view role="button" tabindex="0" @click="store.hydrate" @keydown.enter="store.hydrate">Retry</view></view>
    <view v-else-if="store.hydration_status !== 'ready'" class="events-state" role="status">Loading events…</view>
    <view v-else-if="!store.session.is_authenticated" class="events-state" role="alert">Your session has expired. Please sign in again.</view>
    <view v-else-if="!events.length" class="events-state events-empty">No events match this filter. Try another option.</view>
    <scroll-view v-else :key="store.active_event_tab" class="events-carousel" :scroll-x="!sheet_locked && !is_loading" :show-scrollbar="false">
      <view class="events-track">
        <view v-for="(event, index) in events" :key="event.event_id" class="event-card" :data-event-id="event.event_id" :data-interaction="index ? 'events.m.open.click.1' : null" :data-target="target('detail', event.event_id)" @click="index && navigate('detail', event.event_id)">
          <view class="event-cover" role="button" tabindex="0" :aria-label="`View ${event.title}`" :data-interaction="!index ? 'events.openEvent.click.1' : null" @click.stop="navigate('detail', event.event_id)" @keydown.enter.stop="navigate('detail', event.event_id)"><ProfilePhoto :src="event.image_url" :name="event.title" event-cover /></view>
          <view class="event-body">
            <text class="event-title" role="button" tabindex="0" :data-interaction="!index ? 'events.openEvent.click.2' : null" @click.stop="navigate('detail', event.event_id)" @keydown.enter.stop="navigate('detail', event.event_id)">{{ event.title }}</text>
            <view class="event-info"><view class="events-icon"><SourceIcon name="events" :stroke-width="1.9" /></view><text>{{ event.date_label }}</text></view>
            <view class="event-info event-location"><view class="events-icon"><SourceIcon name="location" /></view><text>{{ event.location }}</text></view>
            <view class="event-participants" :role="index ? undefined : 'button'" :tabindex="index ? undefined : 0" :data-interaction="!index ? 'events.openParticipants.click.1' : null" :data-target="!index ? target('participants', event.event_id) : null" @click="!index && navigate('participants', event.event_id)" @keydown.enter="!index && navigate('participants', event.event_id)">
              <view v-if="event.participants.length" class="event-avatars"><view v-for="person in event.participants" :key="person.user_id" class="event-avatar"><UserAvatar :src="person.avatar_url" :name="person.user_name" /></view></view>
              <text class="event-count">{{ event.participant_count }} going · {{ event.available_count }} spaces left of {{ event.capacity }}</text>
            </view>
            <view class="event-actions">
              <view class="event-join" :class="{ 'event-join--joined': event.joined }" role="button" tabindex="0" :data-interaction="index ? 'events.m.join.click.1' : 'events.evJoinTap.click.1'" @click.stop="open('join', event.event_id)" @keydown.enter.stop="open('join', event.event_id)">{{ event.joined ? 'Joined' : 'Join event' }}</view>
              <view v-if="event.joined" class="event-manage">
                <view role="button" tabindex="0" data-interaction="events.openGroup.click.1" :data-target="target('group', event.event_id)" @click.stop="navigate('group', event.event_id)" @keydown.enter.stop="navigate('group', event.event_id)">Event group chat</view>
                <view class="event-manage-divider" />
                <view role="button" tabindex="0" data-interaction="events.manageAttendance.click.1" @click.stop="open('cancel', event.event_id)" @keydown.enter.stop="open('cancel', event.event_id)">Manage</view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    <template #footer><text v-if="feedback" class="events-feedback" role="status">{{ feedback }}</text></template>
    <template #overlays>
      <EvJoinConfirmDialog :open="sheet === 'join'" :event-id="selected_id" :busy="is_loading" :error="dialog_error" @confirm="submit" @close="close" @released="!sheet && (sheet_locked = false)" />
      <EvCancelConfirmDialog :open="sheet === 'cancel'" :busy="is_loading" :error="dialog_error" @confirm="submit" @close="close" @released="!sheet && (sheet_locked = false)" />
      <EventActionLoading :visible="is_loading" :label="loading_label" />
    </template>
  </MainTabFrame>
</template>

<style scoped>
.events-header { padding: 11.45rpx 38.168rpx 26.718rpx; }
.events-toolbar { display: flex; align-items: center; justify-content: space-between; }
.events-me {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 103.053rpx;
  height: 103.053rpx;
  border-radius: 50%;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  cursor: pointer;
}
.events-person-icon { width: 49.618rpx; height: 49.618rpx; }
.events-icon { width: 38.168rpx; height: 38.168rpx; flex: none; }
.events-upcoming {
  display: flex;
  align-items: center;
  gap: 15.267rpx;
  height: 91.603rpx;
  padding: 0 34.351rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-header);
  font-size: 30.534rpx;
  font-weight: 700;
  cursor: pointer;
}
.events-title {
  display: block;
  margin-top: 26.718rpx;
  font-size: 72.519rpx;
  line-height: 1.04;
  font-weight: 800;
  letter-spacing: -0.035em;
}
.events-subtitle { display: block; margin-top: 15.267rpx; font-size: 32.443rpx; color: var(--cimoa-text-secondary); }
.events-tabs { display: flex; gap: 19.084rpx; margin-top: 34.351rpx; }
.events-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 99.237rpx;
  padding: 0 38.168rpx;
  border-radius: 49.618rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-event-chip);
  font-size: 32.443rpx;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.events-chip--active { color: var(--cimoa-text-inverse); background: var(--cimoa-gradient-primary); }
.events-carousel { width: 100%; touch-action: pan-x pan-y; }
.events-carousel :deep(.uni-scroll-view) { scroll-snap-type: x mandatory; }
.events-track { display: flex; align-items: stretch; gap: 22.901rpx; padding: 7.634rpx 38.168rpx 34.351rpx; }
.event-card {
  display: flex;
  flex-direction: column;
  flex: none;
  width: calc(100% - 83.969rpx);
  scroll-snap-align: start;
  scroll-margin-left: 38.168rpx;
  border-radius: 49.618rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-event-card);
  overflow: hidden;
}
.event-cover { position: relative; flex: none; height: 408.397rpx; cursor: pointer; }
.event-body { display: flex; flex-direction: column; flex: 1; min-width: 0; padding: 26.718rpx 30.534rpx 30.534rpx; }
.event-title { font-size: 43.893rpx; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.event-info { display: flex; align-items: center; gap: 17.176rpx; margin-top: 15.267rpx; font-size: 32.443rpx; }
.event-info text { min-width: 0; overflow-wrap: anywhere; }
.event-location { margin-top: 13.359rpx; }
.event-participants { display: flex; align-items: center; gap: 22.901rpx; margin-top: 22.901rpx; }
.event-participants[role="button"] { cursor: pointer; }
.event-avatars { display: flex; flex: none; }
.event-avatar { width: 68.702rpx; height: 68.702rpx; border-radius: 50%; border: 2px solid var(--cimoa-surface-card); }
.event-avatar + .event-avatar { margin-left: -20.992rpx; }
.event-count { min-width: 0; font-size: 28.626rpx; color: var(--cimoa-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-actions { margin-top: auto; padding-top: 26.718rpx; }
.event-join {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 99.237rpx;
  border-radius: 49.618rpx;
  color: var(--cimoa-text-inverse);
  background: var(--cimoa-gradient-primary);
  box-shadow: var(--cimoa-shadow-event-join);
  font-size: 36.26rpx;
  font-weight: 700;
  cursor: pointer;
}
.event-join--joined { color: var(--cimoa-status-event-joined-ink); background: var(--cimoa-status-connected-bg); box-shadow: none; }
.event-manage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22.901rpx;
  margin-top: 22.901rpx;
  font-size: 30.534rpx;
  font-weight: 600;
}
.event-manage [role="button"] { cursor: pointer; color: var(--cimoa-text-event-link); }
.event-manage [role="button"]:last-child { color: var(--cimoa-text-tertiary); }
.event-manage-divider { width: 1px; height: 26.718rpx; background: var(--cimoa-surface-border); }
.events-state {
  display: flex;
  flex-direction: column;
  gap: 22.901rpx;
  margin: 7.634rpx 38.168rpx 34.351rpx;
  padding: 45.802rpx;
  border-radius: 45.802rpx;
  background: var(--cimoa-surface-empty);
  color: var(--cimoa-text-secondary);
  font-size: 30.534rpx;
  line-height: 1.5;
}
.events-state [role="button"] { color: var(--cimoa-text-link); cursor: pointer; }
.events-feedback {
  display: block;
  padding: 15.267rpx 38.168rpx;
  font-size: 26.718rpx;
  line-height: 1.4;
  color: var(--cimoa-text-secondary);
  overflow-wrap: anywhere;
}
</style>
