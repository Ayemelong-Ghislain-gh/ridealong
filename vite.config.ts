import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA install button is temporarily disabled — workbox-build fails during
// `vite build` on this machine due to a Windows temp-folder path issue
// (spaces in the user profile path). Fix: set TEMP/TMP env vars to a
// space-free path (e.g. C:\temp), then flip this back to true.
const PWA_ENABLED = false

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    PWA_ENABLED &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/192.png', 'icons/512.png'],
        manifest: {
          name: 'Ride Along',
          short_name: 'Ride Along',
          description: 'Book your seat on taxis leaving Bamenda\'s parks',
          theme_color: '#1C2321',
          background_color: '#F5F6F4',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icons/192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          // Don't let the service worker cache Supabase API/auth calls -
          // trips, bookings and auth state must always come from the network.
          navigateFallbackDenylist: [/^\/(rest|auth|realtime)\//],
        },
        devOptions: {
          // Keep disabled during `npm run dev`. Workbox's service-worker
          // generation runs against the dev server's virtual/transformed
          // modules rather than a real build, which is unstable and can
          // throw errors unrelated to your app code. Test the installable
          // PWA with `npm run build && npm run preview` instead — that's
          // also what actually runs in production on Vercel.
          enabled: false,
        },
      }),
  ],
})
