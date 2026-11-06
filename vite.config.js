import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'validate-firebase-config',
      configResolved(config) {
        if (config.command !== 'build') return

        const requiredFirebaseEnv = [
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_STORAGE_BUCKET',
          'VITE_FIREBASE_MESSAGING_SENDER_ID',
          'VITE_FIREBASE_APP_ID',
        ]
        const missing = requiredFirebaseEnv.filter((name) => !config.env[name]?.trim())

        if (missing.length) {
          throw new Error(`Configure o Firebase em .env.local antes de publicar. Faltam: ${missing.join(', ')}`)
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            if (id.includes('/firestore') || id.includes('\\firestore')) {
              return 'firebase-firestore'
            }

            if (id.includes('/auth') || id.includes('\\auth')) {
              return 'firebase-auth'
            }

            if (id.includes('/app') || id.includes('\\app') || id.includes('/component') || id.includes('\\component')) {
              return 'firebase-app'
            }

            return 'firebase-shared'
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }

          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})
