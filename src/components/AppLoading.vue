<script setup>
import ActionLoading from './ActionLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Please wait…' } })
</script>
<template><ActionLoading :visible="visible" :label="label" scope="app" /></template>
