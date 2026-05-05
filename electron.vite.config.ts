import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const pkgPath = fileURLToPath(new URL('./package.json', import.meta.url))
const appVersion = (JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }).version

export default defineConfig({
  main: {},
  /** CJS preload — 일부 환경에서 ESM(.mjs) preload가 로드되어도 브리지가 안 잡히는 문제 완화 */
  preload: {
    build: {
      lib: {
        formats: ['cjs'],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.cjs',
        },
      },
    },
  },
  renderer: {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    },
    plugins: [react()],
    publicDir: resolve(__dirname, 'public'),
    server: {
      port: 7777,
    },
  },
})
