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
        navigateFallbackDenylist: [
          /^https?:\/\/[^/]*supabase\.co/,
          /^\/api\//,
          /\.(pdf|docx|xlsx|zip|mp4|webm)$/i
        ],
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(png|jpe?g|gif|svg|webp)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(js|css|woff2?)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})