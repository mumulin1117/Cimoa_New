<script setup>
import { ref } from 'vue'
import { use_event_page } from '@/composables/useEventPage.js'
import { previous_event_is_detail } from '@/utils/eventsNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const frame = ref(null)
const { event, event_id, error, access_error, go, back } = use_event_page(frame, { joinedOnly: true })
const open_event = () => previous_event_is_detail(event_id.value) ? back() : go('detail', event_id.value, true)
</script>
<template>
  <SecondaryPageFrame ref="frame" class="event-page event-success-page">
    <view v-if="access_error" class="event-page-state" role="alert">{{ access_error }}</view>
    <view v-else class="event-success-content">
      <view class="event-success-icon"><SourceIcon name="check" :stroke-width="2.8" /></view>
      <text class="event-page-title">You’re going</text><text class="event-success-name">{{ event.title }}</text><text class="event-success-description">{{ event.date_label }}<br />{{ event.location }} · {{ event.university }}</text>
    </view>
    <template #footer><text v-if="error" class="event-page-error" role="alert">{{ error }}</text><view class="event-page-footer">
      <view v-if="access_error" class="event-page-secondary" role="button" tabindex="0" @click="back()" @keydown.enter="back()">Back to events</view>
      <template v-else><view class="event-page-primary" role="button" tabindex="0" data-interaction="evJoinSuccess.openJoined.click.1" @click="open_event" @keydown.enter="open_event">Open event</view><view class="event-page-secondary" role="button" tabindex="0" data-interaction="evJoinSuccess.openMyEvents.click.1" @click="go('upcoming', event_id, true)" @keydown.enter="go('upcoming', event_id, true)">View My Events</view></template>
    </view></template>
  </SecondaryPageFrame>
</template>
