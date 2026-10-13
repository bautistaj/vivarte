import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_PATH se inyecta como build arg en Docker: /vivarte/
  // En dev local queda como / para que el proxy funcione sin prefijo.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    proxy: {
      '/api':   { target: 'http://localhost:3000', changeOrigin: true },
      '/a':     { target: 'http://localhost:3000', changeOrigin: true },
      '/files': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
