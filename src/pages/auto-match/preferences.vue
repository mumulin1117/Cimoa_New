<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import FlowPageHeader from '@/components/FlowPageHeader.vue'
import EventActionLoading from '@/components/EventActionLoading.vue'

const store = use_app_store(), frame = ref(null), error = ref(''), navigating = ref(false)
const original = store.match_preferences
const draft = ref(original ? JSON.parse(JSON.stringify(original)) : null)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const access_error = computed(() => !store.session.is_authenticated ? 'Your session has expired. Please sign in again.' : !draft.value ? 'Matching preferences are unavailable.' : '')
const groups = computed(() => [
  { title: 'University', key: 'university', options: ['All', store.current_user.university, 'Nearby universities'].filter((v, i, a) => v && a.indexOf(v) === i) },
  { title: 'Degree / Major', key: 'major', options: ['All', store.current_user.major, 'Similar major', 'STEM', 'Business', 'Arts & Humanities'].filter((v, i, a) => v && a.indexOf(v) === i) },
  { title: 'MBTI Personality', key: 'mbti', options: ['All', 'Similar type', 'Complementary type'] },
  { title: 'Religion', key: 'religion', options: ['All', 'Same religion', 'Open to all'] },
  { title: 'Drinking Habits', key: 'drinking', options: ['All', 'Never', 'Socially', 'Regularly'] },
  { title: 'Preferred Language', key: 'language', options: ['English', 'Cantonese', 'Mandarin'] },
  { title: 'Gender Preference', key: 'gender', options: ['Everyone', 'Women', 'Men'] },
  { title: 'Connection Goal', key: 'goal_id', options: store.data.goals.map(row => row.item_id), labels: Object.fromEntries(store.data.goals.map(row => [row.item_id, `${row.emoji} ${row.label}`])) },
])
const toggle_interest = id => { const rows = draft.value.interest_ids; draft.value.interest_ids = rows.includes(id) ? rows.filter(value => value !== id) : rows.length < 5 ? [...rows, id] : rows }
const back = async () => { if (is_loading.value || navigating.value) return; try { await frame.value.navigate_back('/pages/auto-match/index') } catch (cause) { error.value = cause.message } }
const save = async () => {
  if (is_loading.value || navigating.value || access_error.value) return
  if (!draft.value.interest_ids.length) { error.value = 'Choose at least one interest.'; return }
  const patch = Object.fromEntries(Object.entries(draft.value).filter(([key]) => key !== 'owner_user_id'))
  const result = await run_with_loading(() => store.update_match_preferences(patch))
  if (result.reason === 'cancelled') return
  if (!result.success) { error.value = result.message; return }
  await back()
}
onHide(() => { navigating.value = false; cancel_loading() }); onUnmounted(cancel_loading)
</script>

<template><SecondaryPageFrame ref="frame"><template #header><FlowPageHeader title="Match Preferences" interaction="amPrefs.goBack.click.1" :busy="is_loading || navigating" @back="back" /><text v-if="error" class="flow-error" role="alert">{{ error }}</text></template><view class="flow-body"><template v-if="!access_error"><text class="flow-copy">These shape recommendations. They never guarantee a result and are never shown publicly.</text><text class="flow-label">Age Range · {{ draft.age_min }}–{{ draft.age_max }}</text><slider :value="draft.age_min" min="18" :max="draft.age_max" active-color="var(--cimoa-button-primary)" data-interaction="amPrefs.onAgeTrack.click.1" @change="draft.age_min = Number($event.detail.value)" /><slider :value="draft.age_max" :min="draft.age_min" max="45" active-color="var(--cimoa-button-primary)" @change="draft.age_max = Number($event.detail.value)" /><text class="flow-label">Height Range · {{ draft.height_min }}–{{ draft.height_max }} cm</text><slider :value="draft.height_min" min="140" :max="draft.height_max" active-color="var(--cimoa-button-primary)" data-interaction="amPrefs.onHeightTrack.click.1" @change="draft.height_min = Number($event.detail.value)" /><slider :value="draft.height_max" :min="draft.height_min" max="210" active-color="var(--cimoa-button-primary)" @change="draft.height_max = Number($event.detail.value)" /><text class="flow-label">Distance · within {{ draft.distance_max }} km</text><slider :value="draft.distance_max" min="1" max="100" active-color="var(--cimoa-button-primary)" data-interaction="amPrefs.onDistanceTrack.click.1" @change="draft.distance_max = Number($event.detail.value)" /><text class="flow-label">Interests · {{ draft.interest_ids.length }}/5</text><view class="flow-chip-row"><view v-for="item in store.data.interests" :key="item.item_id" class="flow-chip" :class="{ 'flow-chip--selected': draft.interest_ids.includes(item.item_id) }" role="button" data-interaction="amPrefs.o.pick.click.2" @click="toggle_interest(item.item_id)">{{ item.emoji }} {{ item.label }}</view></view><view v-for="group in groups" :key="group.key"><text class="flow-label">{{ group.title }}</text><view class="flow-chip-row"><view v-for="option in group.options" :key="option" class="flow-chip" :class="{ 'flow-chip--selected': draft[group.key] === option }" role="button" data-interaction="amPrefs.o.pick.click.1" @click="draft[group.key] = option">{{ group.labels?.[option] || option }}</view></view></view></template><view v-else class="flow-card" role="alert">{{ access_error }}</view></view><template #footer><view v-if="!access_error" class="flow-footer"><view class="flow-primary" role="button" :aria-disabled="is_loading || navigating" data-interaction="amPrefs.savePrefs.click.1" @click="save">Save</view></view></template><template #overlays><EventActionLoading :visible="is_loading" label="Saving match preferences…" /></template></SecondaryPageFrame></template>
