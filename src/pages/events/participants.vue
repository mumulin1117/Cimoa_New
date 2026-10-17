<script setup>
import { ref, computed } from 'vue'
import { use_event_page } from '@/composables/useEventPage.js'
import { require_discover_destination_ready } from '@/utils/discoverNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import SourceIcon from '@/components/SourceIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
const frame = ref(null), query = ref('')
const { store, event, event_id, access_error, error, back, go } = use_event_page(frame)
const people = computed(() => store.event_people(event_id.value, query.value))
const person = async id => {
  if (access_error.value) return
  if (id === store.session.current_user_id) { await go('profile'); return }
  try { if (!store.event_people(event_id.value).some(user => user.user_id === id)) throw new Error('This participant is no longer available.'); await frame.value.navigate_forward(require_discover_destination_ready(`/pages/discover/profile?user_id=${encodeURIComponent(id)}`)) }
  catch (cause) { error.value = cause.message }
}
</script>
<template>
  <SecondaryPageFrame ref="frame" class="event-page event-participants-page">
    <template #header><EventPageHeader title="Participants" back-interaction="evParticipants.goBack.click.1" @back="back()" /></template>
    <view v-if="access_error" class="event-page-state" role="alert">{{ access_error }}</view>
    <view v-else class="event-page-body">
      <view class="event-people-search"><view class="event-page-icon"><SourceIcon name="discover" /></view><input v-model="query" aria-label="Search participants" placeholder="Search participants" :maxlength="120" data-interaction="evParticipants.onSearch.change.1" /></view>
      <text class="event-people-caption">{{ event.participant_count }} going · joining an event does not connect you automatically</text>
      <view v-for="user in people" :key="user.user_id" class="event-page-card event-person" role="button" tabindex="0" :data-user-id="user.user_id" data-interaction="evParticipants.p.go.click.1" @click="person(user.user_id)" @keydown.enter="person(user.user_id)">
        <view class="event-person-avatar"><UserAvatar :src="user.avatar_url" :name="user.user_name" /></view><view class="event-person-copy"><text class="event-person-name">{{ user.user_name }}</text><text class="event-person-meta">{{ user.meta }}</text></view><text class="event-person-badge" :class="{ 'event-person-badge--connected': user.relationship_label === 'Connected' }">{{ user.relationship_label }}</text>
      </view>
      <view v-if="!people.length" class="event-page-state">{{ query.trim() ? 'No participants match your search.' : 'No visible participants yet.' }}</view>
    </view>
    <template #footer><text v-if="error" class="event-page-error" role="alert">{{ error }}</text></template>
  </SecondaryPageFrame>
</template>

<style scoped>
.event-person-name { font-weight: 800; letter-spacing: -0.02em; }
.event-person-meta { margin-top: 3.817rpx; }
.event-person-badge { font-weight: 600; }
.event-people-search { gap: 19.084rpx; }
.event-people-search .event-page-icon { width: 38.168rpx; height: 38.168rpx; }
</style>
