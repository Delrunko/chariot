import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Pour les URLs signées Supabase : on ignore le token dans la clé de cache,
// sinon chaque nouvelle URL signée est considérée comme un nouveau fichier.
const ignoreTokenInCacheKey = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url)
    url.search = ''
    return url.href
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
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
        // IMPORTANT : Chrome exige des icônes PNG 192x192 et 512x512
        // (à placer dans le dossier public/)
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico,webp,woff2}'],
        runtimeCaching: [
          // Données Supabase (livres, témoignages...) : réseau d'abord, cache si hors ligne
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Couvertures et fichiers (Storage Supabase) : cache d'abord
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage/v1/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-files',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
              plugins: [ignoreTokenInCacheKey],
            },
          },
          // Polices et icônes externes (Font Awesome, Google Fonts...)
          {
            urlPattern: /^https:\/\/(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|use\.fontawesome\.com|kit\.fontawesome\.com|ka-f\.fontawesome\.com)\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'external-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})