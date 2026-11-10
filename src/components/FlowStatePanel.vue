<script setup>
import SourceIcon from './SourceIcon.vue'
import BrandProgressMark from './BrandProgressMark.vue'
defineProps({ icon: { type: String, default: 'check' }, title: String, copy: String, person: Object, loading: Boolean })
</script>

<template>
  <view class="flow-state-panel" :role="loading ? 'status' : undefined" :aria-busy="loading || undefined">
    <view class="flow-state-icon" :class="{ 'flow-state-icon--loading': loading }"><BrandProgressMark v-if="loading" /><SourceIcon v-else :name="icon" /></view>
    <text class="flow-title">{{ title }}</text>
    <text class="flow-copy">{{ copy }}</text>
    <view v-if="person" class="flow-person-card"><image :src="person.avatar_url" mode="aspectFill" /><view><text>{{ person.user_name }}</text><text>{{ [person.age, person.university, person.major].filter(Boolean).join(' · ') }}</text></view></view>
    <slot />
  </view>
</template>

<style scoped>
.flow-state-icon--loading { background: var(--cimoa-surface-toast-icon); box-shadow: var(--cimoa-shadow-toast); }
</style>
