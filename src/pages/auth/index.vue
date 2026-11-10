<script setup>
import { auth_message } from '@/utils/authFeedback.js'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { auth_destination } from '@/utils/authNavigation.js'
import { replace_route } from '@/utils/routeTransition.js'
import AuthPageFrame from '@/components/AuthPageFrame.vue'
const error = ref('')
onLoad(async options => {
  const target = { login: '/pages/auth/login', signup: '/pages/auth/age', legalTerms: '/pages/legal/terms', legalPrivacy: '/pages/legal/privacy' }[options?.view] || '/pages/auth/welcome'
  try { await replace_route(auth_destination(target)) } catch (cause) { error.value = cause.message }
})
</script>
<template><AuthPageFrame title="Cimoa" @back="replace_route('/pages/auth/welcome')"><text v-if="error" role="alert">{{ auth_message(error) }}</text></AuthPageFrame></template>
