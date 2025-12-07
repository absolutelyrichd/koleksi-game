import { defineConfig } from 'vite';

export default defineConfig({
  // Pastikan base adalah '/' agar semua path absolut (seperti /sw.js) berfungsi
  base: '/',
  
  // Jika kamu perlu menyalin file tambahan dari public ke root dist
  build: {
    // Vite secara otomatis menyalin semua dari public/ ke dist/
    // Jadi, jika sw.js ada di public/, dia akan muncul di dist/
    // Kita tidak perlu konfigurasi khusus jika strukturnya sudah benar.

    // Namun, jika kamu mengalami masalah, kamu bisa menambahkan konfigurasi 
    // untuk memastikan aset di-inline (walaupun ini bukan solusi ideal untuk SW)
  }
});