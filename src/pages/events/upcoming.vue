<script setup>
import { ref, computed } from 'vue'
import { use_event_page } from '@/composables/useEventPage.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import ProfilePhoto from '@/components/ProfilePhoto.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import EvCancelConfirmDialog from '@/components/EvCancelConfirmDialog.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'
const frame = ref(null)
const { store, event_id, error, access_error, sheet, locked, is_loading, go, back, open, close, attendance } = use_event_page(frame, { needsEvent: false })
const groups = computed(() => store.my_event_groups), featured = computed(() => groups.value.featured)
const manage = id => { event_id.value = id; open('cancel') }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="event-page event-upcoming-page" :scroll-locked="locked || is_loading">
    <template #header><EventPageHeader title="My events" back-interaction="evUpcoming.goBack.click.1" :busy="is_loading" @back="back()" /></template>
    <view v-if="access_error" class="event-page-state" role="alert">{{ access_error }}</view>
    <view v-else class="event-page-body">
      <view v-if="featured" class="event-page-card event-upcoming-featured" :data-event-id="featured.event_id">
        <view class="event-upcoming-summary" role="button" tabindex="0" data-interaction="evUpcoming.openJoined.click.1" @click="go('detail', featured.event_id)" @keydown.enter="go('detail', featured.event_id)"><view class="event-upcoming-cover"><ProfilePhoto :src="featured.image_url" :name="featured.title" event-cover /></view><view class="event-upcoming-copy"><text class="event-upcoming-title">{{ featured.title }}</text><text>{{ featured.date_label }}</text><text>{{ featured.location }}</text></view></view>
        <view class="event-upcoming-actions"><view class="event-page-primary" role="button" tabindex="0" data-interaction="evUpcoming.openGroupStop.click.1" @click="go('group', featured.event_id)" @keydown.enter="go('group', featured.event_id)">Group chat</view><view class="event-page-secondary" role="button" tabindex="0" data-interaction="evUpcoming.manageStop.click.1" @click="manage(featured.event_id)" @keydown.enter="manage(featured.event_id)">Manage</view></view>
      </view>
      <template v-for="section in groups.sections" :key="section.label"><text class="event-page-section">{{ section.label }}</text><view v-for="item in section.events" :key="item.event_id" class="event-page-card event-upcoming-row" :data-event-id="item.event_id" role="button" tabindex="0" :data-interaction="section.interaction_id" @click="go('detail', item.event_id)" @keydown.enter="go('detail', item.event_id)"><view class="event-upcoming-cover"><ProfilePhoto :src="item.image_url" :name="item.title" event-cover /></view><view class="event-upcoming-copy"><text class="event-upcoming-title">{{ item.title }}</text><text>{{ item.date_label }}</text><text>{{ item.location }} · {{ item.participant_count }} going</text></view><view class="event-page-icon"><SourceIcon name="chevron" /></view></view></template>
      <view v-if="!featured && !groups.sections.length" class="event-page-state">You haven’t joined any events yet. Explore campus events to find your next plan.</view>
    </view>
    <template #footer><FeedbackToast v-if="error && !sheet" :message="error" @dismiss="error = String()" /></template>
    <template #overlays><EvCancelConfirmDialog :open="sheet === 'cancel'" :busy="is_loading" :error="error" @close="close" @confirm="attendance" @released="!sheet && (locked = false)" /><EventActionLoading :visible="is_loading" label="Cancelling attendance…" /></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.event-upcoming-featured { margin-top: 7.634rpx; }
.event-upcoming-title { font-weight: 800; letter-spacing: -0.025em; }
.event-upcoming-copy > text { margin-top: 5.725rpx; }
.event-upcoming-copy > text + text + text { margin-top: 0; }
.event-upcoming-row .event-upcoming-cover { border-radius: 30.534rpx; }
.event-upcoming-row .event-upcoming-title { letter-spacing: -0.02em; }
.event-upcoming-row .event-upcoming-copy > text + text + text { margin-top: 1.908rpx; }
.event-page-section { margin-top: 45.802rpx; font-size: 36.26rpx; font-weight: 800; }
.event-upcoming-actions .event-page-secondary { border-width: 1.5px; border-color: var(--cimoa-surface-verification-shield-border); font-weight: 700; }
</style>
