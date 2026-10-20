<script setup>
import AppLoading from './AppLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Signing in…' } })
</script>
<template><AppLoading :visible="visible" :label="label" /></template>
