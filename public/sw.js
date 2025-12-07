// ==========================================================
// 1. Konfigurasi Cache (HARUS DIUBAH jika ada update aset)
// ==========================================================
// Nama cache untuk aset statis (App Shell)
const CACHE_STATIC = 'app-shell-v2'; 
// Nama cache untuk data dinamis atau API
const CACHE_DYNAMIC = 'dynamic-data-v1'; 

// Daftar aset statis yang WAJIB di-cache saat instalasi
const urlsToCache = [
  '/', 
  '/index.html',
  // Pastikan PATH dan NAMA file kamu sesuai
  // Jika menggunakan Vite, pastikan file ini ada di folder 'public/' atau diakses dari root 'dist/'
  '/script.js', 
  '/images/icon-192.png',
  '/images/icon-512.png'
];


// ==========================================================
// 2. PHASE INSTALL: Menyimpan App Shell ke Cache
// ==========================================================
self.addEventListener('install', event => {
  console.log('Service Worker: Install event triggered. Caching App Shell...');
  
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        // Menyimpan semua aset statis
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        // Penting: Jika ada satu aset yang 404/gagal, seluruh instalasi SW akan gagal!
        console.error('Service Worker: Cache Installation Failed! Check all paths in urlsToCache.', err);
      })
  );
  self.skipWaiting(); // Memaksa SW baru mengambil alih kendali segera
});


// ==========================================================
// 3. PHASE ACTIVATE: Membersihkan Cache Lama
// ==========================================================
self.addEventListener('activate', event => {
  console.log('Service Worker: Activate event triggered. Cleaning old caches...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Hapus cache yang namanya tidak sesuai dengan yang aktif
          if (cacheName !== CACHE_STATIC && cacheName !== CACHE_DYNAMIC) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Ambil kontrol dari client/tab yang sudah ada
  return self.clients.claim(); 
});


// ==========================================================
// 4. PHASE FETCH: Caching Strategy (Cache-First & Stale-While-Revalidate)
// ==========================================================
self.addEventListener('fetch', event => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // A. Strategi Cache-First (untuk App Shell/Aset Statis)
  // Jika request cocok dengan aset yang sudah ditentukan statis (urlsToCache)
  if (urlsToCache.includes(requestUrl.pathname)) {
    event.respondWith(
        caches.match(event.request) // Cek cache dulu
    );
    return;
  }
  
  // B. Strategi Stale-While-Revalidate (untuk Data Dinamis, API, atau gambar)
  event.respondWith(
    caches.open(CACHE_DYNAMIC).then(cache => {
      // 1. Cek cache (respons cepat dari "Stale" data)
      return cache.match(event.request).then(response => {
        
        // 2. Selalu coba fetch dari network di background (Revalidate)
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Jika fetch sukses, simpan respons baru ke cache dinamis
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(err => {
             console.error('Service Worker: Fetch failed for dynamic data.', err);
             // Di sini, kita bisa mengembalikan fallback page/data jika diperlukan
          });

        // Kembalikan response dari cache jika ada, ATAU tunggu fetch network
        // Jika offline, 'response' akan dikembalikan jika ada.
        return response || fetchPromise;
      });
    })
  );
});