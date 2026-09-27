import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backendUrl = (env.VITE_DEV_API_URL || 'http://localhost:3000').replace(/\/$/, '')
  const frontendPort = Number.parseInt(env.VITE_DEV_PORT || '5173', 10)

  return {
    plugins: [react()],
    // Keep hooks, React DOM, and React Router on the same React module instance.
    // This also avoids stale optimized-dependency bundles after package updates
    // during a long-running Vite development session.
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
    },
    server: {
      port: Number.isInteger(frontendPort) && frontendPort > 0 ? frontendPort : 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
