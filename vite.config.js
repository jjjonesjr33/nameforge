import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite 8 + @vitejs/plugin-react v6 bug: transformIndexHtml preamble not injected.
// Manually inject the React Fast Refresh preamble so $RefreshSig$ is available globally.
const reactRefreshPreamble = {
  name: 'react-refresh-preamble',
  apply: 'serve',
  transformIndexHtml() {
    return [{
      tag: 'script',
      attrs: { type: 'module' },
      injectTo: 'head-prepend',
      children: [
        'import { injectIntoGlobalHook } from "/@react-refresh";',
        'injectIntoGlobalHook(window);',
        'window.$RefreshReg$ = () => {};',
        'window.$RefreshSig$ = () => (type) => type;',
        'window.__vite_plugin_react_preamble_installed__ = true;',
      ].join('\n'),
    }];
  },
};

export default defineConfig({
  plugins: [reactRefreshPreamble, react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false, // never ship source maps — no code leakage in production bundle
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
