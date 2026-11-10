import { defineConfig } from 'vite'
import uni_package from '@dcloudio/vite-plugin-uni'
import { cimoa_localization } from './scripts/lib/localized-template.mjs'

const uni = uni_package.default || uni_package

export default defineConfig({
  plugins: [cimoa_localization(), uni()],
  server: { port: 5173 }
})
