import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { publicConfig } from './scripts/public-config'

const envDir = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig(({ mode }) => ({
  envDir,
  plugins: [react(), publicConfig(loadEnv(mode, envDir, 'VITE_'))],
  build: {
    target: ['es2020', 'safari16.4'],
    rollupOptions: {
      output: {
        // WKWebView's local asset handler serves .js with the JavaScript MIME type.
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.mjs'))
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
}))
