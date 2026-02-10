import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/my-stock-dashboard',
  server: {
    proxy: {
      // '/api'로 시작하는 요청이 오면, Vite가 대신 구글 서버로 갑니다.
      '/api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        followRedirects: true // 리다이렉트도 따라가라!
      }
    }
  }
})