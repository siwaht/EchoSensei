import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for better DX
      fastRefresh: true,
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    // Target modern browsers for better optimization
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets < 4kb
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : [],
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true, // Fix Safari 10 issues
      },
      format: {
        comments: false, // Remove comments
      },
    },
    rollupOptions: {
      output: {
        // Optimize chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Enhanced code splitting strategy
        manualChunks: (id) => {
          // Vendor chunks for better caching
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') || id.includes('react-dom') || id.includes('wouter')) {
              return 'react-vendor';
            }
            // Radix UI components
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            // React Query
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'form-vendor';
            }
            // Charts
            if (id.includes('recharts')) {
              return 'chart-vendor';
            }
            // Icons
            if (id.includes('lucide-react')) {
              return 'icon-vendor';
            }
            // Other node_modules
            return 'vendor';
          }
        },
        // Optimize dynamic imports
        experimentalMinChunkSize: 10000, // Minimum chunk size of 10kb
      },
    },
    chunkSizeWarningLimit: 1000,
    // Report compressed size for better insights
    reportCompressedSize: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'wouter',
      '@tanstack/react-query',
      'lucide-react',
      'zod',
      'react-hook-form',
    ],
    // Exclude deps that should not be pre-bundled
    exclude: [],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    // Enable HMR optimizations
    hmr: {
      overlay: true,
    },
  },
  // Performance hints
  esbuild: {
    // Drop console logs in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    // Optimize for modern browsers
    target: 'es2020',
    legalComments: 'none',
  },
  // Enable JSON optimization
  json: {
    stringify: true,
  },
});
