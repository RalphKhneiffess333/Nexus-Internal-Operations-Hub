import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/tickets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/departments': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
