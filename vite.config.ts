import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: [
        'firebase-admin/app',
        'firebase-admin/storage',
        '@aws-sdk/client-s3',
        '@aws-sdk/s3-request-presigner',
      ],
      output: {
        // Chunks estáveis por biblioteca — browser cacheia e não precisa re-baixar em cada deploy se a lib não mudou.
        // Reduz drasticamente o tamanho do bundle inicial principal.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'query': ['@tanstack/react-query'],
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-toast',
          ],
          'charts': ['recharts'],
          'date-fns': ['date-fns'],
          'icons': ['lucide-react'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  publicDir: 'public',
}));
