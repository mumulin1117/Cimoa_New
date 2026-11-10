<script setup>
import ActionLoading from './ActionLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Processing your purchase…' } })
</script>
<template><ActionLoading :visible="visible" :label="label" scope="coin" /></template>
