import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

function netlifySpaFallback() {
  let outputDirectory

  return {
    name: 'netlify-spa-fallback',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      copyFileSync(
        resolve(outputDirectory, 'index.html'),
        resolve(outputDirectory, '404.html'),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), netlifySpaFallback()],
})
