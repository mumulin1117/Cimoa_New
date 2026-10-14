<script setup>
import AppLoading from './AppLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Saving your profile…' } })
</script>
<template><AppLoading :visible="visible" :label="label" /></template>
