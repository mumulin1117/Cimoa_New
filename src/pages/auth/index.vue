<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { use_app_store } from '@/stores/store.js'
import { relaunch_route } from '@/utils/routeTransition.js'
import { prepare_main_tab_skeleton } from '@/utils/mainTabSkeleton.js'
import { use_write_loading } from '@/composables/useWriteLoading.js'
import TopSafeArea from '@/components/TopSafeArea.vue'
import AppLoading from '@/components/AppLoading.vue'

const store = use_app_store()
const view = ref('welcome')
const email = ref('')
const password = ref('')
const name = ref('')
const accepted = ref(false)
const error = ref('')
const { is_loading, run_with_loading } = use_write_loading()
const go = (next) => { view.value = next; error.value = '' }
const login = async () => {
  if (!email.value || !password.value) { error.value = 'Enter your email and password.'; return }
  const result = await run_with_loading(() => store.login(email.value, password.value))
  if (!result.success) { error.value = result.message || 'Sign in was cancelled.'; return }
  prepare_main_tab_skeleton()
  try { await relaunch_route('/pages/home/index') } catch (cause) { error.value = cause.message }
}
const signup = async () => {
  if (!name.value.trim() || !email.value.trim() || !password.value.trim() || !accepted.value) { error.value = 'Complete the fields and accept the community agreement.'; return }
  const result = await run_with_loading(() => store.create_account({ email: email.value.trim() }))
  error.value = result.message || 'Student email verification is unavailable.'
}
onLoad((options) => { if (options?.view) view.value = options.view })
</script>

<template>
  <view class="cimoa-page auth-page"><TopSafeArea /><scroll-view class="auth-scroll" scroll-y :show-scrollbar="false"><view class="brand-mark"><image src="/static/assets/icons/ic-connect.png" mode="aspectFit" /></view><template v-if="view === 'welcome'"><text class="auth-eyebrow">Cimoa</text><text class="auth-title">Find the people and plans that make campus feel like yours.</text><text class="auth-copy">A thoughtful social space for your everyday life.</text><view class="cimoa-button" role="button" @click="go('login')">Log in</view><view class="cimoa-button ghost auth-secondary" role="button" @click="go('signup')">Create account</view><view class="legal-link" role="button" @click="go('legalTerms')">Terms and Privacy</view></template><template v-else-if="view === 'legalTerms' || view === 'legalPrivacy'"><text class="auth-title">{{ view === 'legalTerms' ? 'Terms of Service' : 'Privacy Policy' }}</text><text class="legal-copy">Cimoa is designed for respectful campus connection. Use the app thoughtfully, protect other people's privacy, and keep conversations kind. Your profile and interactions are stored to keep your experience consistent across screens.</text><view class="cimoa-button" role="button" @click="go('welcome')">Done</view></template><template v-else-if="view === 'signup'"><text class="auth-eyebrow">Create account</text><text class="auth-title">A good first hello starts here.</text><input v-model="name" class="auth-input" placeholder="Your name" /><input v-model="email" class="auth-input" placeholder="Email address" type="text" /><input v-model="password" class="auth-input" placeholder="Password" password /><view class="agreement" role="button" @click="accepted = !accepted"><view class="check" :class="{ checked: accepted }" /> <text>I agree to the Community Agreement.</text></view><view class="cimoa-button" role="button" @click="signup">Create account</view><view class="legal-link" role="button" @click="go('welcome')">Back to welcome</view></template><template v-else><text class="auth-eyebrow">Welcome back</text><text class="auth-title">Good to see you again.</text><input v-model="email" class="auth-input" placeholder="Email address" type="text" /><input v-model="password" class="auth-input" placeholder="Password" password /><view class="cimoa-button" role="button" @click="login">Log in</view><view class="legal-link" role="button" @click="go('signup')">Create a new account</view><view class="legal-link" role="button" @click="go('welcome')">Back to welcome</view></template><text v-if="error" class="auth-error">{{ error }}</text></scroll-view><AppLoading :visible="is_loading" label="Signing you in..." /></view>
</template>

<style scoped>
.auth-page { min-height: 100vh; }
.auth-scroll { height: 100vh; padding: 70rpx 48rpx 60rpx; }
.brand-mark { width: 78rpx; height: 78rpx; margin-bottom: 70rpx; border-radius: 24rpx; background: var(--cimoa-primary); }
.brand-mark image { width: 100%; height: 100%; border-radius: 24rpx; }
.auth-eyebrow {
  display: block;
  color: var(--cimoa-success);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  text-transform: uppercase;
}
.auth-title {
  display: block;
  margin-top: 16rpx;
  color: var(--cimoa-title);
  font-size: 45rpx;
  font-weight: 700;
  line-height: 56rpx;
}
.auth-copy { display: block; margin: 18rpx 0 36rpx; color: var(--cimoa-secondary); font-size: 23rpx; line-height: 35rpx; }
.auth-secondary { margin-top: 14rpx; }
.legal-link { margin-top: 24rpx; color: var(--cimoa-secondary); font-size: 20rpx; text-align: center; }
.legal-copy { display: block; margin: 24rpx 0 34rpx; color: var(--cimoa-secondary); font-size: 22rpx; line-height: 36rpx; }
.auth-input {
  display: block;
  width: 100%;
  height: 82rpx;
  margin-top: 16rpx;
  padding: 0 22rpx;
  border: 1px solid var(--cimoa-outline);
  border-radius: 18rpx;
  background: var(--cimoa-card);
  color: var(--cimoa-title);
  font-size: 22rpx;
}
.agreement {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 22rpx 0;
  color: var(--cimoa-secondary);
  font-size: 19rpx;
}
.check { width: 28rpx; height: 28rpx; border: 1px solid var(--cimoa-outline); border-radius: 8rpx; }
.check.checked { border-color: var(--cimoa-primary); background: var(--cimoa-primary); }
.auth-error {
  display: block;
  margin-top: 20rpx;
  color: var(--cimoa-danger);
  font-size: 20rpx;
  line-height: 30rpx;
  text-align: center;
}
</style>
