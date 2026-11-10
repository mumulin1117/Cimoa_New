<script setup>
import { onUnmounted, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { action_notice } from '@/utils/authNotice.js'
const props = defineProps({ visible: Boolean, label: { type: String, default: 'Please wait…' }, scope: { type: String, default: 'app' } })
const owner = Symbol('action-loading')
let active = true
const release = () => action_notice.dismiss(owner)
const sync = () => { if (active && props.visible) action_notice.show(owner, props.label, { scope: props.scope }); else release() }
watch(() => [props.visible, props.label, props.scope], sync, { immediate: true, flush: 'sync' })
onHide(() => { active = false; release() })
onShow(() => { active = true; sync() })
onUnmounted(release)
</script>
<template><slot /></template>
