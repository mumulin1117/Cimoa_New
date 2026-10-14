<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { startup_destination } from '@/utils/authNavigation.js'
import ProfileEditorFrame from '@/components/ProfileEditorFrame.vue'

const store = use_app_store(), frame = ref(null), error = ref(''), account_id = store.session.account_id
const original = store.match_preferences, draft = ref(original ? JSON.parse(JSON.stringify(original)) : null)
const { is_loading, run_with_loading, cancel_loading } = use_write_loading()
const access_error = computed(() => !store.session.is_authenticated || store.session.account_id !== account_id ? 'Your session ended or the account changed.' : !draft.value ? 'Matching preferences are unavailable.' : '')
const goal_labels = Object.fromEntries(store.data.goals.map(row => [row.item_id, `${row.emoji} ${row.label}`]))
const groups = computed(() => [
  { title: 'Connection goal', key: 'goal_id', options: store.data.goals.map(row => row.item_id), labels: goal_labels },
  { title: 'University range', key: 'university', options: [store.current_user.university, 'Nearby universities', 'All'].filter(Boolean), labels: { [store.current_user.university]: 'My university', All: 'Any supported university' } },
  { title: 'Major', key: 'major', options: ['All', 'Similar major', 'STEM', 'Business', 'Arts & Humanities'], labels: { All: 'Any major' } },
  { title: 'Shared interests', key: 'interest_mode', options: ['Similar interests', 'A mix', 'Surprise me'] },
  { title: 'MBTI personality', key: 'mbti', options: ['All', 'Similar type', 'Complementary type'], labels: { All: 'No preference' } },
  { title: 'Drinking habits', key: 'drinking', options: ['All', 'Never', 'Socially', 'Regularly'], labels: { All: 'No preference' } },
  { title: 'Religion', key: 'religion', options: ['All', 'Same religion', 'Open to all'], labels: { All: 'No preference' } },
  { title: 'Preferred language', key: 'language', options: ['English', 'Cantonese', 'Mandarin'] },
  { title: 'Gender preference', key: 'gender', options: ['Everyone', 'Women', 'Men'], labels: { Everyone: 'Show me everyone' } },
])
const back = async () => { try { await frame.value.navigate_back('/pages/profile/edit') } catch (cause) { error.value = cause.message } }
const recover = async () => { try { await relaunch_route(startup_destination(store)) } catch (cause) { error.value = cause.message } }
const save = async () => { const patch = Object.fromEntries(Object.entries(draft.value).filter(([key]) => key !== 'owner_user_id')); const result = await run_with_loading(() => store.update_match_preferences(patch)); if (result.reason === 'cancelled') return; if (!result.success) { error.value = result.message; return } await back() }
onHide(cancel_loading); onUnmounted(cancel_loading)
</script>
<template><ProfileEditorFrame ref="frame" title="Preferences" source="editPrefs" save action-interaction="editPrefs.savePrefs.click.1" :busy="is_loading" :error="error" :access-error="access_error" loading-label="Saving preferences…" @back="back" @recover="recover" @save="save"><template v-if="draft"><text class="editor-copy">These shape recommendations. They never guarantee a result and are never shown publicly.</text><text class="editor-section">Age range · {{ draft.age_min }}–{{ draft.age_max }}</text><slider :value="draft.age_min" min="18" :max="draft.age_max" active-color="var(--cimoa-button-primary)" @change="draft.age_min = Number($event.detail.value)" /><slider :value="draft.age_max" :min="draft.age_min" max="45" active-color="var(--cimoa-button-primary)" @change="draft.age_max = Number($event.detail.value)" /><text class="editor-section">Height range · {{ draft.height_min }}–{{ draft.height_max }} cm</text><slider :value="draft.height_min" min="140" :max="draft.height_max" active-color="var(--cimoa-button-primary)" @change="draft.height_min = Number($event.detail.value)" /><slider :value="draft.height_max" :min="draft.height_min" max="210" active-color="var(--cimoa-button-primary)" @change="draft.height_max = Number($event.detail.value)" /><text class="editor-section">Distance · {{ draft.distance_max }} km</text><slider :value="draft.distance_max" min="1" max="100" active-color="var(--cimoa-button-primary)" @change="draft.distance_max = Number($event.detail.value)" /><view v-for="group in groups" :key="group.key"><text class="editor-section">{{ group.title }}</text><view class="editor-chips"><view v-for="option in group.options" :key="option" class="editor-chip" :class="{ selected: draft[group.key] === option }" role="button" data-interaction="editPrefs.o.pick.click.1" @click="draft[group.key] = option">{{ group.labels?.[option] || option }}</view></view></view></template></ProfileEditorFrame></template>
