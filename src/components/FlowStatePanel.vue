<script setup>
import SourceIcon from './SourceIcon.vue'
defineProps({ icon: { type: String, default: 'check' }, title: String, copy: String, person: Object })
</script>

<template>
  <view class="flow-state-panel">
    <view class="flow-state-icon"><SourceIcon :name="icon" /></view>
    <text class="flow-title">{{ title }}</text>
    <text class="flow-copy">{{ copy }}</text>
    <view v-if="person" class="flow-person-card"><image :src="person.avatar_url" mode="aspectFill" /><view><text>{{ person.user_name }}</text><text>{{ [person.age, person.university, person.major].filter(Boolean).join(' · ') }}</text></view></view>
    <slot />
  </view>
</template>
