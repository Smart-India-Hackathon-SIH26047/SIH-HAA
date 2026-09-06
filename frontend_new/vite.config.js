import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Saathi - Mental Health & Distress Monitoring',
        short_name: 'Saathi',
        description: 'AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System for Victims of Atrocities',
        theme_color: '#3457D5',
        background_color: '#FAFAF8',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
      },
    }),
  ],
})
