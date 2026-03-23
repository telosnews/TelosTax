import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Replace the CSP connect-src placeholder based on build mode. */
function cspPlugin(): Plugin {
  return {
    name: 'csp-connect-src',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const apiOrigin = process.env.VITE_API_ORIGIN || '';
        // In dev mode, allow localhost:3001; in production, only 'self' + optional API origin
        const connectSrc = ctx.server
          ? "'self' http://localhost:3001"
          : apiOrigin
            ? `'self' ${apiOrigin}`
            : "'self'";
        return html.replace(
          /connect-src\s+'self'[^;]*/,
          `connect-src ${connectSrc}`,
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [
    cspPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/apple-touch-icon.png',
        'icons/favicon-32.png',
      ],
      manifest: {
        name: 'TelosTax — Free Tax Preparation',
        short_name: 'TelosTax',
        description: 'Free, private tax preparation that runs entirely in your browser.',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB — Syncfusion PDF viewer + charts (merged chunk)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          syncfusion: [
            '@syncfusion/ej2-base',
            '@syncfusion/ej2-react-charts',
            '@syncfusion/ej2-react-circulargauge',
            '@syncfusion/ej2-react-pdfviewer',
            '@syncfusion/ej2-pdfviewer',
            '@syncfusion/ej2-pdf',
            '@syncfusion/ej2-pdf-data-extract',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
});
