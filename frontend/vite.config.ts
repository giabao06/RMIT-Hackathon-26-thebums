/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The Tide enclave loads a DPoP relay page from /tide_dpop/iss/<hex>/aud/<hex>/...
// The relay parses iss/aud out of its own URL, so every path under /tide_dpop/
// must serve public/tide_dpop_auth.html with its own CSP and Allow-CSP-From: *.
// Vite has no rewrites config, so this does it for the dev and preview servers.
// A production static host needs the same rewrite and headers.
function tideDpopRelay(): Plugin {
  const relay = (
    req: { url?: string },
    res: { setHeader(name: string, value: string): void },
    next: () => void,
  ) => {
    if (req.url?.startsWith('/tide_dpop/')) {
      req.url = '/tide_dpop_auth.html'
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'unsafe-inline'",
      )
      res.setHeader('Allow-CSP-From', '*')
    }
    next()
  }
  return {
    name: 'tide-dpop-relay',
    configureServer(server) {
      server.middlewares.use(relay)
    },
    configurePreviewServer(server) {
      server.middlewares.use(relay)
    },
  }
}

export default defineConfig({
  plugins: [tideDpopRelay(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
