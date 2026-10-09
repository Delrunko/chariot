import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeManifest: true,
      manifest: {
        name: 'EDS — Librairie technique en ligne',
        short_name: 'EDS',
        description: 'Outils pédagogiques pour apprendre et réviser, même hors connexion.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f1e4',
        theme_color: '#171717',
        icons: [
          {
            src: '/logo.png',
            sizes: 'any',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,woff2,webmanifest}'],
        runtimeCaching: [{
          urlPattern: 'https://klqlajdyxjdqjfjftods.supabase.co/storage/v1/object/public/covers/.*',
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'eds-covers-cache',
            cacheableResponse: { statuses: [200] },
          },
        }],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})