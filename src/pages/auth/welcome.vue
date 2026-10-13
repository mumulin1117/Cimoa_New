<script setup>
import { ref } from 'vue'
import { auth_destination } from '@/utils/authNavigation.js'
import SecondaryPageFrame from '@/components/SecondaryPageFrame.vue'
import SourceIcon from '@/components/SourceIcon.vue'
const frame = ref(null), error = ref(''), photo_status = ref('loading'), photo_key = ref(0)
const go = async target => {
  error.value = ''
  try { await frame.value.navigate_forward(auth_destination(target)) } catch (cause) { error.value = cause.message }
}
const retry_photo = () => { photo_status.value = 'loading'; photo_key.value++ }
</script>
<template>
  <SecondaryPageFrame ref="frame" class="welcome-page">
    <view class="welcome-photo-region">
      <image :key="photo_key" class="welcome-photo" src="/static/assets/img/welcome-campus.png" mode="aspectFill" aria-label="Students walking on campus" @load="photo_status = 'ready'" @error="photo_status = 'error'" />
      <view v-if="photo_status !== 'ready'" class="welcome-photo-status" :role="photo_status === 'error' ? 'alert' : 'status'">
        <text>{{ photo_status === 'loading' ? 'Loading campus photo…' : 'The campus photo could not load.' }}</text>
        <view v-if="photo_status === 'error'" role="button" tabindex="0" @click="retry_photo" @keydown.enter="retry_photo">Retry photo</view>
      </view>
    </view>
    <view class="welcome-copy"><text class="welcome-brand">Cimoa</text><text class="welcome-title">Meet your campus</text><text class="welcome-description">Discover people, conversations, and events around university life.</text></view>
    <template #footer>
      <view class="welcome-footer">
        <text v-if="error" class="welcome-error" role="alert">{{ error }}</text>
        <view class="welcome-create" role="button" tabindex="0" data-interaction="welcome.goAge.click.1" @click="go('/pages/auth/age')" @keydown.enter="go('/pages/auth/age')"><text>Create Account</text><SourceIcon name="arrow-right" :stroke-width="2.4" /></view>
        <view class="welcome-login" role="button" tabindex="0" data-interaction="welcome.goLogin.click.1" @click="go('/pages/auth/login')" @keydown.enter="go('/pages/auth/login')">Log In</view>
        <view class="welcome-legal"><text>By continuing, you agree to our </text><text class="welcome-link" role="button" tabindex="0" data-interaction="welcome.openTerms.click.1" @click="go('/pages/legal/terms')" @keydown.enter="go('/pages/legal/terms')">Terms</text><text> and </text><text class="welcome-link" role="button" tabindex="0" data-interaction="welcome.openPrivacy.click.1" @click="go('/pages/legal/privacy')" @keydown.enter="go('/pages/legal/privacy')">Privacy Policy</text><text>.</text></view>
      </view>
    </template>
  </SecondaryPageFrame>
</template>
<style scoped>
.welcome-photo-region { position: relative; margin: 0 7.634rpx; height: 687.023rpx; }
.welcome-photo { width: 100%; height: 100%; border-radius: 57.252rpx 57.252rpx 0 0; mask-image: var(--cimoa-gradient-welcome-mask); -webkit-mask-image: var(--cimoa-gradient-welcome-mask); }
.welcome-photo-status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22.901rpx;
  color: var(--cimoa-text-secondary);
  font-size: 28.626rpx;
}
.welcome-photo-status [role=button] { color: var(--cimoa-text-link); }
.welcome-copy { display: flex; flex-direction: column; align-items: center; margin: 83.969rpx 45.802rpx 38.168rpx; text-align: center; }
.welcome-brand {
  font-size: 72.519rpx;
  font-weight: 500;
  letter-spacing: .08em;
  padding-left: .08em;
  color: var(--cimoa-text-welcome-brand);
  line-height: 1;
}
.welcome-title {
  margin-top: 41.985rpx;
  font-size: 64.885rpx;
  font-weight: 800;
  letter-spacing: -.04em;
  line-height: 1.05;
  color: var(--cimoa-text-welcome-title);
}
.welcome-description {
  max-width: 553.435rpx;
  margin-top: 19.084rpx;
  font-size: 31.489rpx;
  color: var(--cimoa-text-welcome-copy);
  line-height: 1.4;
  text-wrap: balance;
}
.welcome-footer { display: flex; flex: none; flex-direction: column; gap: 22.901rpx; padding: 0 38.168rpx 57.252rpx; }
.welcome-create {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15.267rpx;
  height: 114.504rpx;
  border-radius: 57.252rpx;
  background: var(--cimoa-gradient-primary);
  color: var(--cimoa-text-inverse);
  box-shadow: var(--cimoa-shadow-auth-action);
  font-size: 36.26rpx;
  font-weight: 700;
}
.welcome-create .source-icon { width: 34.351rpx; height: 34.351rpx; }
.welcome-login {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 106.87rpx;
  border-radius: 53.435rpx;
  background: var(--cimoa-surface-card);
  box-shadow: var(--cimoa-shadow-auth-secondary);
  color: var(--cimoa-text-title);
  font-size: 34.351rpx;
  font-weight: 600;
}
.welcome-legal { margin-top: 3.817rpx; font-size: 27.672rpx; color: var(--cimoa-text-auth-muted); line-height: 1.4; text-align: center; }
.welcome-link { text-decoration: underline; color: var(--cimoa-text-auth-legal); font-weight: 600; }
.welcome-error { font-size: 27.672rpx; line-height: 1.4; color: var(--cimoa-status-danger); }
</style>
