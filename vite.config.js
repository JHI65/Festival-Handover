import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Festival-Handover/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // manifest ya existe en public/manifest.json
      manifest: false,
      // injectManifest (en vez de generateSW) para poder añadir a mano los
      // listeners 'push' y 'notificationclick' en src/sw.js
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,ico,jpg,png,woff2}'],
      },
    }),
  ],
})
