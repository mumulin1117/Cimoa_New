<script setup>
import { ref } from 'vue'
import { use_event_page } from '@/composables/useEventPage.js'
import { copy_event_text, open_event_location } from '@/utils/eventCapabilities.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import EventConfirmDialog from '@/components/EventConfirmDialog.vue'
import EvJoinConfirmDialog from '@/components/EvJoinConfirmDialog.vue'
import EvCancelConfirmDialog from '@/components/EvCancelConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
const frame = ref(null)
const { event_id, event, error, sheet, locked, is_loading, access_error, go, back, open, close, attendance } = use_event_page(frame)
const copy = async () => { try { await copy_event_text(event.value.share_text); error.value = 'Event details copied.' } catch (cause) { error.value = cause.message } }
const map = async () => { try { await open_event_location(event.value) } catch (cause) { error.value = cause.message } }
const deferred = label => { error.value = `${label} is unavailable because this organizer is not linked to a user account. No changes were made.` }
const report = async () => { close(); await go('report') }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="event-page event-detail-page" :scroll-locked="locked || is_loading">
    <template #header><EventPageHeader back-interaction="evDetail.goBack.click.1" more-interaction="evDetail.openEventMore.click.1" :busy="is_loading" @back="back()" @more="open('more')" /></template>
    <view v-if="access_error" class="event-page-state" role="alert">{{ access_error }}</view>
    <template v-else-if="event">
      <view class="event-detail-cover"><ProfilePhoto :src="event.image_url" :name="event.title" event-cover /></view>
      <view class="event-page-body event-detail-body">
        <text class="event-page-title">{{ event.title }}</text>
        <view class="event-page-card event-detail-host"><view class="event-detail-host-icon">{{ event.organizer?.badge_label }}</view><view><text class="event-detail-host-label">Hosted by</text><text class="event-detail-host-name">{{ event.organizer?.name || 'Organizer not provided' }}<view v-if="event.organizer?.verified" class="event-detail-verified"><SourceIcon name="verified" /></view></text></view></view>
        <view class="event-page-card event-detail-info">
          <view class="event-detail-row"><view class="event-detail-disc"><view class="event-page-icon"><SourceIcon name="events" :stroke-width="1.9" /></view></view><view class="event-detail-row-main"><text class="event-detail-row-title">{{ event.date_label }}</text></view></view>
          <view class="event-detail-row" role="button" tabindex="0" data-interaction="eventDetail.location.open.click.1" @click="open('location')" @keydown.enter="open('location')"><view class="event-detail-disc event-detail-disc--location"><view class="event-page-icon"><SourceIcon name="location" /></view></view><view class="event-detail-row-main"><text class="event-detail-row-title">{{ event.location }}</text></view></view>
          <view class="event-detail-row" role="button" tabindex="0" data-interaction="evDetail.openParticipantsList.click.1" @click="go('participants')" @keydown.enter="go('participants')"><view class="event-detail-disc event-detail-disc--people"><view class="event-page-icon"><SourceIcon name="people" /></view></view><view class="event-detail-row-main"><text class="event-detail-row-title" data-event-count>{{ event.attendance_label }}</text><view class="event-detail-avatars"><view v-for="person in event.participants" :key="person.user_id" class="event-detail-avatar"><UserAvatar :src="person.avatar_url" :name="person.user_name" /></view><text class="event-detail-participants-link">View participants ›</text></view></view></view>
        </view>
        <text class="event-page-copy event-detail-description">{{ event.description || 'The organizer has not added a description yet.' }}</text>
        <text class="event-page-section">Schedule</text>
        <view class="event-page-card event-detail-schedule"><view v-for="(item, index) in event.schedule" :key="index" class="event-detail-schedule-row"><view class="event-detail-timeline" /><view><text class="event-detail-time">{{ item.time_label }}</text><text class="event-detail-schedule-title">{{ item.label }}</text><text class="event-detail-schedule-copy">{{ item.description }}</text></view></view><text v-if="!event.schedule.length" class="event-detail-schedule-copy">No schedule has been provided.</text></view>
        <text class="event-page-section">Good to know</text>
        <view class="event-detail-notes"><view v-for="note in event.note_chips" :key="note.label" class="event-detail-note"><text v-if="note.emoji" class="event-detail-note-emoji">{{ note.emoji }}</text><text>{{ note.label }}</text></view><text v-if="!event.notes.length" class="event-detail-schedule-copy">No additional notes yet.</text></view>
        <template v-if="event.joined && event.organizer?.update_text"><text class="event-page-section">Organizer update</text><view class="event-page-card event-detail-schedule"><text class="event-detail-schedule-copy">{{ event.organizer.update_text }}</text></view></template>
      </view>
    </template>
    <template #footer>
      <text v-if="error && !sheet" class="event-page-error" role="alert">{{ error }}</text>
      <view v-if="event && !access_error" class="event-page-footer">
        <template v-if="event.joined"><view class="event-page-primary" role="button" tabindex="0" data-interaction="evDetail.openGroup.click.1" @click="go('group')" @keydown.enter="go('group')"><view class="event-page-icon"><SourceIcon name="support" /></view>Open Group Chat</view><view class="event-page-secondary" role="button" tabindex="0" data-interaction="evDetail.manageAttendance.click.1" @click="open('cancel')" @keydown.enter="open('cancel')">Manage Attendance</view></template>
        <view v-else class="event-page-primary" role="button" tabindex="0" data-interaction="evDetail.askJoin.click.1" @click="open('join')" @keydown.enter="open('join')">{{ event.ended ? 'Event ended' : event.available_count ? 'Join Event' : 'Event full' }}</view>
      </view>
    </template>
    <template #overlays>
      <EvJoinConfirmDialog :open="sheet === 'join'" :event-id="event_id" :busy="is_loading" :error="error" @confirm="attendance" @close="close" @released="!sheet && (locked = false)" />
      <EvCancelConfirmDialog :open="sheet === 'cancel'" :busy="is_loading" :error="error" @confirm="attendance" @close="close" @released="!sheet && (locked = false)" />
      <EventConfirmDialog :open="['more', 'share', 'location'].includes(sheet)" :label="sheet === 'location' ? 'Event location' : sheet === 'share' ? 'Share Event' : event?.title || 'Event options'" close-interaction="sheetEvMore.closeSheet.click.1" @close="close" @released="!sheet && (locked = false)">
        <text class="event-dialog-title">{{ sheet === 'location' ? 'Event location' : sheet === 'share' ? 'Share Event' : event?.title }}</text>
        <template v-if="sheet === 'more'"><view class="event-page-menu" role="button" tabindex="0" data-interaction="sheetEvMore.shareEvent.click.1" @click="sheet = 'share'" @keydown.enter="sheet = 'share'">Share Event</view><view class="event-page-menu" role="button" tabindex="0" data-interaction="sheetEvMore.openEventReport.click.1" @click="report" @keydown.enter="report">Report Event</view><view class="event-page-menu event-dialog-danger" role="button" tabindex="0" data-interaction="sheetEvMore.blockOrganizer.click.1" @click="deferred('Block Organizer')" @keydown.enter="deferred('Block Organizer')">Block Organizer</view></template>
        <template v-else-if="sheet === 'share'"><text selectable class="event-page-copy">{{ event?.share_text }}</text><view class="event-dialog-primary" role="button" tabindex="0" data-interaction="eventDetail.share.copy.click.1" @click="copy" @keydown.enter="copy">Copy event details</view></template>
        <template v-else-if="sheet === 'location'"><text selectable class="event-page-copy">{{ event?.address || event?.location }} · {{ event?.university }}</text><text class="event-page-copy">{{ event?.accessibility }}</text><view class="event-dialog-primary" role="button" tabindex="0" data-interaction="eventDetail.location.map.click.1" @click="map" @keydown.enter="map">Open map</view></template>
        <text v-if="error" class="event-dialog-error" role="alert">{{ error }}</text><view class="event-dialog-secondary" role="button" tabindex="0" data-interaction="sheetEvMore.closeSheet.click.2" @click="close" @keydown.enter="close">Cancel</view>
      </EventConfirmDialog>
      <EventActionLoading :visible="is_loading" :label="sheet === 'join' ? 'Joining event…' : 'Cancelling attendance…'" />
    </template>
  </SecondaryPageFrame>
</template>

<style scoped>
.event-detail-host-label { color: var(--cimoa-text-auth-placeholder); font-weight: 700; letter-spacing: 0.06em; }
.event-detail-host-name { display: flex; align-items: center; gap: 7.634rpx; margin-top: 3.817rpx; }
.event-detail-verified { display: inline-flex; width: 32.443rpx; height: 32.443rpx; flex: none; }
.event-detail-row:last-child { align-items: flex-start; }
.event-detail-participants-link { font-weight: 700; }
.event-detail-avatars { margin-top: 15.267rpx; }
.event-detail-description { margin-top: 34.351rpx; }
.event-page-section { font-weight: 800; }
.event-detail-schedule-row { gap: 26.718rpx; }
.event-detail-time { font-weight: 700; color: var(--cimoa-text-auth-placeholder); }
.event-detail-schedule-title { margin-top: 3.817rpx; font-weight: 700; }
.event-detail-schedule-copy { margin-top: 3.817rpx; }
.event-detail-note {
  display: flex;
  align-items: center;
  gap: 13.359rpx;
  padding: 0 22.901rpx;
  font-weight: 500;
  color: var(--cimoa-text-profile-bio);
}
.event-detail-note-emoji { font-size: 32.443rpx; }
.event-page-footer { padding-bottom: 64.885rpx; }
</style>
