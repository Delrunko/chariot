import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function offlinePrecachePlugin() {
  let root
  let outDir
  let base
  let supabaseOrigin

  return {
    name: 'offline-precache-manifest',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(root, config.build.outDir)
      base = config.base
      const supabaseUrl = loadEnv(config.mode, root, 'VITE_').VITE_SUPABASE_URL
      supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''
    },
    async closeBundle() {
      const files = []
      const collectFiles = async (directory) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name)
          if (entry.isDirectory()) {
            await collectFiles(path)
          } else {
            const name = relative(outDir, path).split(sep).join('/')
            if (
              name !== 'service-worker.js'
              && /\.(html|js|mjs|css|svg|png|jpe?g|webp|woff2?|webmanifest)$/i.test(name)
            ) {
              files.push(`${base}${name}`)
            }
          }
        }
      }

      await collectFiles(outDir)
      const workerPath = resolve(outDir, 'service-worker.js')
      const workerSource = await readFile(workerPath, 'utf8')
      await writeFile(
        workerPath,
        workerSource
          .replace('__PRECACHE_URLS__', JSON.stringify(files))
          .replace('__SUPABASE_ORIGIN__', JSON.stringify(supabaseOrigin)),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlinePrecachePlugin()],
})
