import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'

const buildId = randomUUID()

// https://vite.dev/config/
export default defineConfig({
  define: { 'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(buildId) },
  plugins: [
    react(),
    { name: 'app-version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: buildId }) }) } },
    {
      name: 'validate-firebase-config',
      configResolved(config) {
        if (config.command === 'build' && config.mode === 'rehearsal') throw new Error('O ensaio é apenas local. Use npm run ensaio para praticar.')
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
        codeSplitting: {
          groups: [
            { name: 'preload-helper', test: /preload-helper/, priority: 100 },
            { debugName: 'application-dependencies', name(id) {
                if (['html2canvas', 'canvg', 'rgbcolor', 'stackblur-canvas', 'utrie', 'text-segmentation', 'css-line-break', '@babel/runtime', 'core-js', 'dompurify'].some((name) => id.includes(`node_modules/${name}/`) || id.includes(`node_modules\\${name.replaceAll('/', '\\')}\\`))) return 'pdf-renderer'
                if (id.includes('node_modules/jspdf') || id.includes('node_modules/@pdf-lib')) return 'pdf-writer'
                if (id.includes('node_modules/pdfjs-dist')) return 'pdf-reader'
                if (id.includes('node_modules/mammoth')) return 'word-reader'
                if (id.includes('node_modules/tesseract')) return 'ocr-reader'
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
            } },
          ],
        },
      },
    },
  },
})
