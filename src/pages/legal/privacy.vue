<script setup>
import { ref } from 'vue'
import { use_app_store } from '@/stores/store.js'
import { privacy_document } from '@/utils/legalDocuments.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const back = async () => {
  const fallback = store.session.is_authenticated ? '/pages/settings/legal' : '/pages/auth/welcome'
  try { await frame.value.navigate_back(fallback) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="event-page legal-privacy-page">
    <template #header><EventPageHeader :title="privacy_document.title" back-interaction="isLegalDoc.goBack.click.1" @back="back" /><text v-if="error" class="event-page-error" role="alert">{{ error }}</text></template>
    <view class="legal-document-body">
      <text class="legal-document-updated">{{ privacy_document.updated }}</text>
      <text class="legal-document-intro">{{ privacy_document.intro }}</text>
      <view class="legal-document-card"><view v-for="section in privacy_document.sections" :key="section[0]" class="legal-document-section"><text class="legal-document-heading">{{ section[0] }}</text><text class="legal-document-copy">{{ section[1] }}</text></view></view>
      <text class="legal-document-footer">No production privacy or support contact is configured for this local build.</text>
    </view>
  </SecondaryPageFrame>
</template>

<style>
@import './legal-pages.css';
</style>
