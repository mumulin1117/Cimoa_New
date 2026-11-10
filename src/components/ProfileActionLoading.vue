<script setup>
import ActionLoading from './ActionLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Updating your profile…' } })
</script>
<template><ActionLoading :visible="visible" :label="label" scope="profile" /></template>
