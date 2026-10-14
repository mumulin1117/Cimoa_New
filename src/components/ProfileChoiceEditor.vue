<script setup>
import { computed, ref } from 'vue'
import { use_profile_editor } from '@/composables/useProfileEditor.js'
import ProfileEditorFrame from './ProfileEditorFrame.vue'
const props = defineProps({ kind: { type: String, required: true } }), frame = ref(null)
const { store, context, account_id, error, access_error, is_loading, back, recover, submit } = use_profile_editor(frame, '/pages/profile/edit')
const field = props.kind === 'interests' ? 'interest_ids' : 'goal_ids', ids = ref([...(context.value?.user[field] || [])])
const source = computed(() => props.kind === 'interests' ? 'editInterests' : 'editGoals'), options = computed(() => props.kind === 'interests' ? store.onboarding_catalog.interests : store.onboarding_catalog.goals)
const pick = id => { if (is_loading.value) return; error.value = ''; ids.value = ids.value.includes(id) ? ids.value.filter(value => value !== id) : [...ids.value, id] }
const save = () => { const patch = { [field]: [...ids.value] }; error.value = store.profile_validation_error(props.kind, patch); if (!error.value) submit(() => store.save_profile_section(props.kind, patch, account_id)) }
</script>
<template>
  <ProfileEditorFrame ref="frame" :class="`profile-${kind}-page`" :title="kind === 'interests' ? 'Interests' : 'Connection goals'" :source="source" save :busy="is_loading" :error="error" :access-error="access_error" @back="back" @recover="recover" @save="save">
    <text class="editor-copy">{{ kind === 'interests' ? `${ids.length} selected · choose at least 3` : 'Choose as many as you like. Cimoa isn’t only for dating.' }}</text>
    <view class="editor-chips"><view v-for="item in options" :key="item.item_id" class="editor-chip" :class="{ selected: ids.includes(item.item_id) }" role="button" :aria-pressed="ids.includes(item.item_id)" :data-choice-id="item.item_id" :data-interaction="`${source}.o.pick.click.1`" @click="pick(item.item_id)"><text>{{ item.emoji }}</text>{{ item.label }}</view></view>
  </ProfileEditorFrame>
</template>
