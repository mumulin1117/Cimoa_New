<script setup>
defineProps({ document: { type: Object, required: true }, sheet: Boolean })
</script>

<template>
  <view class="legal-document-content" :class="{ 'legal-document-content--sheet': sheet }" :data-legal-document="document.id" :data-legal-revision="document.revision">
    <text class="legal-document-updated">{{ document.updated }}</text>
    <text class="legal-document-intro">{{ document.intro }}</text>
    <view class="legal-document-card"><view v-for="section in document.sections" :key="section[0]" class="legal-document-section"><text class="legal-document-heading">{{ section[0] }}</text><text class="legal-document-copy">{{ section[1] }}</text></view></view>
    <text class="legal-document-footer">{{ document.footer }}</text>
  </view>
</template>

<style scoped>
.legal-document-content { overflow-wrap: anywhere; }
.legal-document-updated { display: block; color: var(--cimoa-text-auth-placeholder); font-size: 26.718rpx; }
.legal-document-intro { display: block; margin-top: 22.901rpx; color: var(--cimoa-text-profile-bio); font-size: 30.534rpx; line-height: 1.55; }
.legal-document-card { margin-top: 34.351rpx; padding: 11.45rpx 38.168rpx; border-radius: 45.802rpx; background: var(--cimoa-surface-card); box-shadow: var(--cimoa-shadow-card); }
.legal-document-section { padding: 30.534rpx 0; border-bottom: 1px solid var(--cimoa-surface-event-divider); }
.legal-document-section:last-child { border-bottom: 0; }
.legal-document-heading { display: block; font-size: 32.443rpx; font-weight: 800; letter-spacing: -0.015em; }
.legal-document-copy { display: block; margin-top: 11.45rpx; color: var(--cimoa-text-auth-legal); font-size: 29.58rpx; line-height: 1.55; }
.legal-document-footer { display: block; margin-top: 34.351rpx; color: var(--cimoa-text-auth-placeholder); font-size: 26.718rpx; line-height: 1.5; text-align: center; }
.legal-document-content--sheet .legal-document-updated { display: block; margin-top: 19.084rpx; color: var(--cimoa-text-secondary); font-size: 26.718rpx; }
.legal-document-content--sheet .legal-document-intro, .legal-document-content--sheet .legal-document-copy { display: block; color: var(--cimoa-text-secondary); font-size: 29.58rpx; line-height: 1.55; }
.legal-document-content--sheet .legal-document-intro { margin-top: 22.901rpx; }
.legal-document-content--sheet .legal-document-card { margin: 0; padding: 0; border-radius: 0; background: none; box-shadow: none; }
.legal-document-content--sheet .legal-document-section { margin-top: 30.534rpx; padding: 0; border: 0; }
.legal-document-content--sheet .legal-document-heading { display: block; color: var(--cimoa-text-title); font-size: 32.443rpx; font-weight: 700; line-height: 1.4; }
.legal-document-content--sheet .legal-document-copy { margin-top: 11.45rpx; }
.legal-document-content--sheet .legal-document-footer { display: block; margin-top: 30.534rpx; color: var(--cimoa-text-secondary); font-size: 26.718rpx; line-height: 1.5; text-align: left; }
</style>
