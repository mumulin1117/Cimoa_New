<script setup>
import { ref } from 'vue'
import { use_onboarding } from '@/composables/useOnboarding.js'
import OnboardingFrame from '@/components/OnboardingFrame.vue'
const frame = ref(null), { context, catalog, error, access_error, is_loading, back, recover, save } = use_onboarding('interests', frame), selected = ref([...(context.value?.profile.interest_ids || [])])
const toggle = id => { error.value = ''; selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id] }
</script>
<template>
  <OnboardingFrame ref="frame" step="interests" :busy="is_loading" :error="error" :access-error="access_error" :disabled="selected.length < 3" interaction="obInterests.goObGoal.click.1" @back="back" @recover="recover" @continue="save({ interest_ids: [...selected] })">
    <text class="onboarding-title">What are you into?</text><text class="auth-description">Pick at least three. They help us suggest people and events.</text>
    <text class="interests-counter">{{ selected.length }} of 3 minimum</text>
    <view class="onboarding-chips interest-chips"><view v-for="row in catalog.interests" :key="row.item_id" class="onboarding-chip" :class="{ selected: selected.includes(row.item_id) }" role="checkbox" tabindex="0" :aria-label="row.label" :aria-checked="selected.includes(row.item_id)" data-interaction="obInterests.o.pick.click.1" @click="toggle(row.item_id)" @keydown.space.prevent="toggle(row.item_id)"><text class="interest-emoji">{{ row.emoji }}</text><text>{{ row.label }}</text></view></view>
  </OnboardingFrame>
</template>
<style>
@import './onboarding.css';
</style>
<style scoped>
.interests-counter { display: block; margin-top: 30.534rpx; font-size: 27.672rpx; font-weight: 700; color: var(--cimoa-text-auth-placeholder); }
.interest-chips { margin-top: 22.901rpx; }
.interest-chips .onboarding-chip { min-height: 95.42rpx; padding-right: 38.168rpx; padding-left: 38.168rpx; }
.interest-emoji { font-size: 34.351rpx; line-height: 1; }
</style>
