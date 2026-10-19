<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { legal_return_route } from '@/utils/legalNavigation.js'
import { use_app_store } from '@/stores/store.js'
import { terms_document } from '@/utils/legalDocuments.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import EventPageHeader from '@/components/EventPageHeader.vue'
import LegalDocumentContent from '@/components/LegalDocumentContent.vue'

const store = use_app_store()
const frame = ref(null)
const error = ref('')
const origin = ref(''), return_context_id = ref('')
onLoad(options => { origin.value = String(options?.origin || ''); return_context_id.value = String(options?.return_context_id || '') })
const back = async () => {
  const fallback = legal_return_route(store, origin.value, return_context_id.value)
  try { await frame.value.navigate_back(fallback) } catch (cause) { error.value = cause.message }
}
</script>

<template>
  <SecondaryPageFrame ref="frame" class="event-page legal-terms-page">
    <template #header><EventPageHeader :title="terms_document.title" back-interaction="isLegalDoc.goBack.click.1" @back="back" /><text v-if="error" class="event-page-error" role="alert">{{ error }}</text></template>
    <LegalDocumentContent class="legal-document-body" :document="terms_document" />
  </SecondaryPageFrame>
</template>

<style>
@import './legal-pages.css';
</style>
