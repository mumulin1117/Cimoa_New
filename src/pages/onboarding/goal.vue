<script setup>
import { ref } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
const frame = ref(null), { context, catalog, error, access_error, is_loading, back, recover, save } = use_onboarding('goal', frame), selected = ref([...(context.value?.profile.goal_ids || [])])
const toggle = id => { error.value = ''; selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id] }
</script>
<template>
  <OnboardingFrame ref="frame" step="goal" :busy="is_loading" :error="error" :access-error="access_error" :disabled="!selected.length" interaction="obGoal.goObIce.click.1" back-interaction="obGoal.goBack.click.1" :source-index="6" :source-total="8" :source-progress="72" @back="back" @recover="recover" @continue="save({ goal_ids: [...selected] })">
    <text class="onboarding-title">What are you here for?</text><text class="auth-description">Choose as many as you like. You can update this anytime.</text>
    <view class="onboarding-chips goal-chips"><view v-for="row in catalog.goals" :key="row.item_id" class="onboarding-chip" :class="{ selected: selected.includes(row.item_id) }" role="checkbox" tabindex="0" :aria-label="row.label" :aria-checked="selected.includes(row.item_id)" data-interaction="obGoal.o.pick.click.1" @click="toggle(row.item_id)" @keydown.space.prevent="toggle(row.item_id)"><text class="goal-emoji">{{ row.emoji }}</text><text>{{ row.label }}</text></view></view>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.onboarding-goal-page :deep(.onboarding-content) { padding-bottom: 286.26rpx; }
.onboarding-goal-page :deep(.onboarding-footer) { padding-bottom: 57.252rpx; }
.goal-chips { margin-top: 34.351rpx; }
.goal-chips .onboarding-chip { min-height: 95.42rpx; padding-right: 38.168rpx; padding-left: 38.168rpx; }
.goal-emoji { font-size: 34.351rpx; line-height: 1; }
</style>
