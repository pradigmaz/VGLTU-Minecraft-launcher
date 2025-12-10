import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    // API URL инжектится при сборке. Для прода: VITE_API_URL=http://server npm run build
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:8000'),
  },
  plugins: [
    react(),
    electron({
      main: {
        // Entry point of your Main Process
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              // ⚠️ CRITICAL: Tell Vite NOT to bundle these Node.js libraries
              external: [
                'fs-extra',
                'axios',
                'p-limit',
                '@xmcl/core',
                '@xmcl/installer',
                '@xmcl/user',
                'crypto',
                'path',
                'fs',
                'os',
                'child_process',
                'http',
                'https',
                'net',
                'tls',
                'events',
                'assert',
                'util'
              ]
            }
          }
        }
      },
      preload: {
        // Entry point of your Preload script
        input: 'electron/preload.ts',
      },
      // Optional: integration with the renderer
      renderer: {},
    }),
  ],
})