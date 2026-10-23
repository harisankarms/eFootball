import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The screenshot reader's OCR engine (Tesseract) and its English data, served from this site
 * under /ocr/ instead of a public CDN, which some mobile networks block or slow down.
 * Tesseract picks one of the three engine builds to suit the phone.
 */
const OCR_FILES: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
}

function ocrEngine(): Plugin {
  const read = (name: string) => readFileSync(fileURLToPath(new URL(`./node_modules/${OCR_FILES[name]}`, import.meta.url)))
  return {
    name: 'ocr-engine',
    configureServer(server) {
      server.middlewares.use('/ocr', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
        if (!(name in OCR_FILES)) return next()
        res.setHeader('Content-Type', name.endsWith('.gz') ? 'application/gzip' : 'text/javascript')
        res.end(read(name))
      })
    },
    generateBundle() {
      for (const name of Object.keys(OCR_FILES)) this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: read(name) })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ocrEngine(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'eFootball Tracker',
        short_name: 'eFootball',
        description: 'eFootball results, league table, head-to-heads and Player of the Week for our squad.',
        theme_color: '#050816',
        background_color: '#050816',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fonts are left to the browser's HTTP cache so unused subsets are never downloaded,
        // and the OCR engine is only fetched by people who read a screenshot.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['**/ocr/**'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
