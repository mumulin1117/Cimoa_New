<script setup>
import { onLaunch } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'

onLaunch(() => use_app_store().hydrate())
</script>

<style>* { box-sizing: border-box; }</style>
