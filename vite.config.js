import { defineConfig } from 'vite'
import uni_package from '@dcloudio/vite-plugin-uni'

const uni = uni_package.default || uni_package

export default defineConfig({
  plugins: [uni()],
  server: { port: 5173 }
})
