<script setup>
import { onUnmounted, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { toast } from '@/utils/toast.js'
const props = defineProps({ message: String, tone: { type: String, default: 'error' } })
const emit = defineEmits(['dismiss'])
let id = null, active = true
const release = () => { if (id) toast.dismiss(id, 'source-hidden'); id = null }
watch(() => props.message, message => {
  if (!message) { release(); return }
  if (!active) return
  id = toast.show(message, { tone: props.tone, on_dismiss: reason => { if (['close', 'timeout'].includes(reason)) emit('dismiss') } })
}, { immediate: true })
onHide(() => { active = false; release() })
onShow(() => { active = true })
onUnmounted(release)
</script>
<template><slot /></template>
