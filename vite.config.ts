/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ai': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    // The `prod-guard` test runs in a separate Vitest project that
    // forces `import.meta.env.PROD === true` (see
    // vitest.config.prod-guard.ts). Exclude it from the main project to
    // avoid running it in the default (non-prod) mode where the guard
    // would not fire.
    exclude: ['**/*.prod-guard.test.ts'],
    testTimeout: 15000, // React 19 + Radix Select interactions are slower in full-suite runs
  },
})
