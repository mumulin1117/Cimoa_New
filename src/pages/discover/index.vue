<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { back_route, push_route } from '@/utils/routeTransition.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import CustomTabBar from '@/components/CustomTabBar.vue'
import AppLoading from '@/components/AppLoading.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const store = use_app_store()
const view = ref('list')
const selected_user_id = ref('user_maya')
const show_block = ref(false)
const notice = ref('')
const { is_loading, run_with_loading } = use_write_loading()
const selected_user = computed(() => store.user_by_id(selected_user_id.value))
const selected_relationship = computed(() => store.relationships.find((item) => item.to_user_id === selected_user_id.value))
const open_profile = (user_id) => { selected_user_id.value = user_id; view.value = 'profile' }
const open_chat = (user_id) => push_route(`/pages/messages/index?view=chat&user_id=${user_id}`)
const request_connection = async () => { await run_with_loading(() => store.toggle_relationship(selected_user_id.value)); notice.value = selected_relationship.value?.status === 'requested' ? 'Connection request sent.' : 'Connection request withdrawn.' }
const open_icebreaker = () => { view.value = 'icebreaker' }
const spend_voice = async () => { const result = await run_with_loading(() => store.spend_coins('voice', 'Voice icebreaker')); notice.value = result.success ? 'Voice icebreaker ready.' : 'Not enough coins.' }
const confirm_block = async () => { show_block.value = false; await run_with_loading(() => store.block_user(selected_user_id.value)); view.value = 'list'; notice.value = 'Account blocked.' }
const like_post = (post_id, kind) => store.toggle_post_reaction(post_id, kind)
onLoad((options) => { if (options?.view) view.value = options.view; if (options?.user_id) selected_user_id.value = options.user_id })
</script>

<template>
  <view class="cimoa-page discover-page">
    <TopSafeArea />
    <view v-if="view !== 'list'" class="sub-header"><view class="back-button" role="button" aria-label="Back" @click="view = 'list'"><text>Back</text></view><text class="sub-header__title">{{ view === 'icebreaker' ? 'Icebreaker' : 'Profile' }}</text><view class="sub-header__space" /></view>
    <scroll-view class="cimoa-scroll" scroll-y :show-scrollbar="false">
      <template v-if="view === 'list'">
        <view class="cimoa-header"><view><text class="cimoa-eyebrow">Discover</text><text class="cimoa-title">People with a little spark.</text></view><view class="filter-button" role="button" @click="notice = 'Filters are ready for your next pass.'">Filter</view></view>
        <view v-for="person in store.visible_people" :key="person.user_id" class="discover-card cimoa-card" role="button" @click="open_profile(person.user_id)"><image class="discover-card__image" :src="person.avatar_url" mode="aspectFill" /><view class="discover-card__body"><view class="discover-card__name-row"><text class="discover-card__name">{{ person.user_name }}</text><view class="online-dot" :class="{ online: person.online }" /></view><text class="discover-card__meta">{{ person.major }} · {{ person.distance }}</text><text class="discover-card__bio">{{ person.bio }}</text><view class="discover-card__footer"><text>Open profile</text><text class="discover-card__status">{{ person.online ? 'Online now' : 'Recently active' }}</text></view></view></view>
        <view class="section-head"><view><text class="cimoa-eyebrow">Campus stories</text><text class="cimoa-section-title">Worth a reply</text></view></view>
        <view v-for="post in store.posts" :key="post.post_id" class="post-card cimoa-card"><image class="post-card__image" :src="post.image_url" mode="aspectFill" /><view class="post-card__body"><text class="post-card__title">{{ post.title }}</text><text class="post-card__copy">{{ post.body }}</text><view class="post-card__actions"><text role="button" @click="like_post(post.post_id, 'liked')">{{ post.liked ? 'Liked' : 'Like' }}</text><text role="button" @click="like_post(post.post_id, 'saved')">{{ post.saved ? 'Saved' : 'Save' }}</text><text>{{ post.comment_count }} comments</text></view></view></view>
      </template>
      <template v-else-if="view === 'profile'">
        <view class="profile-hero"><image class="profile-hero__image" :src="selected_user?.avatar_url" mode="aspectFill" /><text class="profile-hero__name">{{ selected_user?.user_name }}</text><text class="profile-hero__meta">{{ selected_user?.major }} · {{ selected_user?.distance }}</text><text class="profile-hero__bio">{{ selected_user?.bio }}</text></view>
        <view class="profile-actions"><view class="cimoa-button" role="button" @click="request_connection">{{ selected_relationship?.status === 'mutual' ? 'Connected' : selected_relationship?.status === 'requested' ? 'Requested' : 'Connect' }}</view><view class="cimoa-button ghost" role="button" @click="open_chat(selected_user_id)">Message</view></view>
        <view class="icebreaker-card cimoa-card"><text class="cimoa-eyebrow">A gentle opener</text><text class="icebreaker-card__question">What is on repeat for you this week?</text><view class="cimoa-button" role="button" @click="open_icebreaker">Answer with voice or text</view></view>
        <view class="profile-link" role="button" @click="show_block = true">Safety and account actions</view>
        <text v-if="notice" class="notice">{{ notice }}</text>
      </template>
      <template v-else>
        <view class="icebreaker-card cimoa-card"><text class="cimoa-eyebrow">Question for {{ selected_user?.user_name }}</text><text class="icebreaker-card__question">What is on repeat for you this week?</text><textarea class="reply-input" placeholder="Write a thoughtful reply" /><view class="cimoa-button" role="button" @click="spend_voice">Send with 10 coins</view><view class="profile-link" role="button" @click="view = 'profile'">Back to profile</view><text v-if="notice" class="notice">{{ notice }}</text></view>
      </template>
    </scroll-view>
    <CustomTabBar active="discover" />
    <AppLoading :visible="is_loading" label="Saving your choice..." />
    <ConfirmDialog :visible="show_block" title="Block this account?" message="You will no longer see this account in Discover or Messages." confirm-label="Block account" danger @cancel="show_block = false" @confirm="confirm_block" />
  </view>
</template>

<style scoped>
.discover-page { padding-bottom: 148rpx; }.sub-header { display: flex; align-items: center; justify-content: space-between; padding: 12rpx 32rpx 18rpx; }.back-button, .filter-button { color: var(--cimoa-secondary); font-size: 22rpx; }.sub-header__title { color: var(--cimoa-title); font-size: 25rpx; font-weight: 700; }.sub-header__space { width: 64rpx; }.discover-card { display: flex; overflow: hidden; margin-bottom: 16rpx; }.discover-card__image { width: 230rpx; height: 244rpx; }.discover-card__body { flex: 1; min-width: 0; padding: 22rpx; }.discover-card__name-row { display: flex; align-items: center; gap: 10rpx; }.discover-card__name { color: var(--cimoa-title); font-size: 27rpx; font-weight: 700; }.online-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: var(--cimoa-tertiary); }.online-dot.online { background: var(--cimoa-success); }.discover-card__meta, .discover-card__bio { display: block; margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 19rpx; line-height: 30rpx; }.discover-card__bio { min-height: 62rpx; color: var(--cimoa-title); }.discover-card__footer { display: flex; justify-content: space-between; margin-top: 20rpx; color: var(--cimoa-success); font-size: 19rpx; font-weight: 700; }.discover-card__status { color: var(--cimoa-secondary); font-weight: 400; }.section-head { display: flex; margin: 38rpx 0 18rpx; }.post-card { overflow: hidden; margin-bottom: 18rpx; }.post-card__image { width: 100%; height: 240rpx; }.post-card__body { padding: 22rpx; }.post-card__title { display: block; color: var(--cimoa-title); font-size: 25rpx; font-weight: 700; }.post-card__copy { display: block; margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 21rpx; line-height: 32rpx; }.post-card__actions { display: flex; gap: 26rpx; margin-top: 18rpx; color: var(--cimoa-success); font-size: 19rpx; }.profile-hero { padding: 12rpx 0 30rpx; text-align: center; }.profile-hero__image { width: 310rpx; height: 330rpx; border-radius: 34rpx; }.profile-hero__name, .profile-hero__meta, .profile-hero__bio { display: block; }.profile-hero__name { margin-top: 22rpx; color: var(--cimoa-title); font-size: 36rpx; font-weight: 700; }.profile-hero__meta { margin-top: 8rpx; color: var(--cimoa-secondary); font-size: 21rpx; }.profile-hero__bio { margin: 18rpx auto 0; max-width: 560rpx; color: var(--cimoa-secondary); font-size: 22rpx; line-height: 34rpx; }.profile-actions { display: flex; gap: 14rpx; margin-bottom: 28rpx; }.profile-actions > view { flex: 1; min-height: 76rpx; }.icebreaker-card { padding: 28rpx; }.icebreaker-card__question { display: block; margin: 16rpx 0 24rpx; color: var(--cimoa-title); font-size: 30rpx; font-weight: 700; line-height: 42rpx; }.profile-link { margin-top: 26rpx; color: var(--cimoa-secondary); font-size: 22rpx; text-align: center; }.reply-input { width: 100%; height: 180rpx; margin-bottom: 22rpx; padding: 18rpx; border: 1px solid var(--cimoa-outline); border-radius: 18rpx; color: var(--cimoa-title); background: var(--cimoa-page); font-size: 22rpx; }.notice { display: block; margin-top: 22rpx; color: var(--cimoa-success); font-size: 20rpx; text-align: center; }
</style>
