import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/FountHW/',
  server: {
    host: '192.168.0.100',
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        main: 'index.html',
        reset: 'reset.html',
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase'
          }
        },
      },
    },
  },
})