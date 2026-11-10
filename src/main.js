import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import FeedbackToast from './components/FeedbackToast.vue'
import { i18n, initialize_locale } from './i18n/index.js'

export function createApp() {
  initialize_locale()
  const app = createSSRApp(App)
  app.use(createPinia())
  app.use(i18n)
  app.component('FeedbackToast', FeedbackToast)
  return { app }
}
