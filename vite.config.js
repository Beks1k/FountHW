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
      output: {
        // Firebase SDK code has cross-package dependencies, so it all goes in
        // one chunk — the app code itself stays separate and lazy routes
        // (AdminPanel) get their own.
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase'
          }
        },
      },
    },
  },
})
