import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Trang quản trị (cms.<tên miền>): build ra ../admin, do server Go phục vụ.
export default defineConfig({
  root: fileURLToPath(new URL('./admin', import.meta.url)),
  base: './',
  plugins: [vue()],
  resolve: { alias: { '@admin': fileURLToPath(new URL('./admin/src', import.meta.url)), '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:8787', '/uploads': 'http://127.0.0.1:8787' } },
  build: { outDir: '../../admin', emptyOutDir: true, target: 'es2019' },
})
