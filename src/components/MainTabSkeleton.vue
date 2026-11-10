<script setup>
import ContentSkeleton from './ContentSkeleton.vue'
defineProps({ route: { type: String, default: 'pages/home/index' } })
</script>
<template><ContentSkeleton class="main-skeleton" :kind="route === 'pages/discover/index' ? 'discover' : route === 'pages/events/index' ? 'events' : 'home'" /></template>
