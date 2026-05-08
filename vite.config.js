import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import sitemap from 'vite-plugin-sitemap'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Automated Sitemap Generation for Pinterest/SEO
    sitemap({
      hostname: 'https://my-journal-viewer.vercel.app',
      // Define the primary paths for Pinterest's crawler to prioritize
      dynamicRoutes: [
        '/waterfalls', 
        '/mountains', 
        '/trekking', 
        '/archaeology', 
        '/camping'
      ],
      // Change frequency helps search engines know how often your journal updates
      changefreq: 'weekly',
      priority: 1.0,
    }),
  ],
})