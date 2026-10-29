import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { i18nTransform } from './build/i18nTransform'

// Website công khai: build ra ../site (đã commit để VPS không cần Node).
export default defineConfig({
  plugins: [vue({ template: { compilerOptions: { nodeTransforms: [i18nTransform] } } })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787', '/uploads': 'http://127.0.0.1:8787' } },
  build: {
    outDir: '../site',
    emptyOutDir: true,
    target: 'es2019',
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
})
