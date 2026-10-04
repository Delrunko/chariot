const CACHE_VERSION = 'eds-v1'
const PRECACHE_NAME = `${CACHE_VERSION}-shell`
const PUBLIC_DATA_NAME = `${CACHE_VERSION}-public-data`
const PUBLIC_ASSETS_NAME = `${CACHE_VERSION}-public-assets`
const PRECACHE_URLS = __PRECACHE_URLS__
const SUPABASE_ORIGIN = __SUPABASE_ORIGIN__
const MAX_RUNTIME_ENTRIES = 250
const PUBLIC_TABLES = new Set([
  'books',
  'book_images',
  'categories',
  'subcategories',
  'services',
  'service_images',
])

async function storeResponse(cacheName, request, response) {
  if (!response.ok) return
  const cache = await caches.open(cacheName)
  await cache.put(request, response.clone())
  const keys = await cache.keys()
  if (keys.length > MAX_RUNTIME_ENTRIES) {
    await cache.delete(keys[0])
  }
}

async function getNetworkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    try {
      await storeResponse(cacheName, request, response)
    } catch (error) {
      console.warn('Offline response could not be cached.', error)
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    throw new Error('Network unavailable and no cached response exists.')
  }
}

async function getAsset(request) {
  const cache = await caches.open(PRECACHE_NAME)
  const cached = await cache.match(request)
  const refresh = fetch(request).then(async (response) => {
    try {
      await storeResponse(PUBLIC_ASSETS_NAME, request, response)
    } catch (error) {
      console.warn('Offline asset could not be cached.', error)
    }
    return response
  })

  if (cached) {
    void refresh.catch(() => {})
    return cached
  }

  const runtimeCached = await caches.match(request)
  if (runtimeCached) {
    void refresh.catch(() => {})
    return runtimeCached
  }
  return refresh
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE_NAME)
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' })
        if (response.ok) await cache.put(url, response)
      } catch (error) {
        console.warn(`Offline asset could not be preloaded: ${url}`, error)
      }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('eds-') && !name.startsWith(CACHE_VERSION))
        .map((name) => caches.delete(name)),
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(PRECACHE_NAME)
        const shell = await cache.match(new URL('index.html', self.registration.scope).href)
        return shell || Response.error()
      }),
    )
    return
  }

  if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) {
    const restMatch = url.pathname.match(/^\/rest\/v1\/([^/]+)/)
    if (restMatch && PUBLIC_TABLES.has(restMatch[1])) {
      event.respondWith(getNetworkFirst(request, PUBLIC_DATA_NAME))
      return
    }

    if (url.pathname.startsWith('/storage/v1/object/public/covers/')) {
      event.respondWith(getNetworkFirst(request, PUBLIC_ASSETS_NAME))
      return
    }
  }

  if (url.origin === self.location.origin) {
    event.respondWith(getAsset(request))
  }
})
