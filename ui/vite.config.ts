import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import inject from '@rollup/plugin-inject';
import react from '@vitejs/plugin-react-swc';
import { Buffer } from 'buffer';
import path from 'path';
import Process from 'process';
import { defineConfig } from 'vite';

globalThis.process = Process;
globalThis.Buffer = Buffer;

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    "global": {}
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
      'styles': path.join(__dirname, 'src/assets/styles'),
    },
  },
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      },
      // Enable esbuild polyfill plugins
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true
        })
      ]
    }
  },
  build: {
    rollupOptions: {
      plugins: [inject({ Buffer: ['Buffer', 'Buffer'], process: 'process' })]
    },
    outDir: '../app/public/',
    emptyOutDir: true,
  },
})
