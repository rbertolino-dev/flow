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
    rollupOptions: {
      external: [
        'firebase-admin/app',
        'firebase-admin/storage',
        '@aws-sdk/client-s3',
        '@aws-sdk/s3-request-presigner',
      ],
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
}));
