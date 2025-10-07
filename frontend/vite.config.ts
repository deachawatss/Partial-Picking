import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

/**
 * Vite Configuration with PWA Support
 *
 * Constitutional Requirements:
 * - Last 5 runs cached offline (FIFO eviction)
 * - Network-first for API (fresh data when online)
 * - Cache fallback when offline
 * - Service worker precaches app shell
 * - Offline banner visible
 * - Weight operations disabled offline
 */

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Prompt user for updates (constitutional requirement)
      registerType: 'prompt',

      // Include static assets for precaching
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],

      // PWA Manifest
      manifest: {
        name: 'Partial Picking System',
        short_name: 'Picking',
        description: 'Production warehouse partial picking with FEFO compliance',
        theme_color: '#0ea5e9', // Tailwind sky-500
        background_color: '#0f172a', // Tailwind slate-900
        display: 'standalone',
        orientation: 'landscape', // Warehouse tablets
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },

      // Workbox Configuration
      workbox: {
        // Precache patterns (app shell + static assets)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],

        // Runtime caching strategies
        runtimeCaching: [
          // API calls: Network-first (fresh data when online, cache fallback)
          {
            urlPattern: /^https?:\/\/localhost:7075\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10, // Fallback to cache after 10s
              cacheableResponse: {
                statuses: [0, 200] // Cache successful responses
              }
            }
          },

          // Run details: Cache-first (last 5 runs in IndexedDB - handled by API layer)
          // This is a fallback cache for when IndexedDB is not available
          {
            urlPattern: /^https?:\/\/localhost:7075\/api\/runs\/\d+$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'runs-cache',
              expiration: {
                maxEntries: 5, // Last 5 runs (FIFO)
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },

          // Static assets: Cache-first
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },

          // Fonts: Cache-first
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ],

        // Clean old caches
        cleanupOutdatedCaches: true,

        // Skip waiting and claim clients
        skipWaiting: true,
        clientsClaim: true
      },

      // Development options
      devOptions: {
        enabled: true, // Enable PWA in development
        type: 'module'
      }
    })
  ],
  server: {
    port: 6060,
    proxy: {
      '/api': {
        target: 'http://localhost:7075',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
