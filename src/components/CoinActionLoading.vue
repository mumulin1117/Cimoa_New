<script setup>
import AppLoading from './AppLoading.vue'
defineProps({ visible: Boolean, label: { type: String, default: 'Confirming your purchase…' } })
</script>
<template><AppLoading :visible="visible" :label="label" /></template>
