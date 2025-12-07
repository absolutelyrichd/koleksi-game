// Contoh Vite Config untuk memastikan aset disalin
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        sw: 'sw.js' // Pastikan sw.js dimasukkan sebagai entry point
      }
    }
  }
});