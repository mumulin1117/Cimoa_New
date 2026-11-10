<script setup>
import ActionLoading from './ActionLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Signing in…' } })
</script>
<template><ActionLoading :visible="visible" :label="label" scope="auth"><slot /></ActionLoading></template>
