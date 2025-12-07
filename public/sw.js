// Nama Cache dan Aset yang akan di-cache
const CACHE_NAME = 'techlife-pwa-cache-v1';

// Daftar aset statis yang WAJIB di-cache saat pertama kali instal (untuk offline)
const urlsToCache = [
  '/', // Halaman utama (root)
  '/index.html',
  '/script.js', // Ganti dengan nama file JS utama kamu
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// 1. PHASE INSTALL: Menyimpan aset ke cache
self.addEventListener('install', event => {
  console.log('Service Worker: Install event');
  // Menunggu sampai cache terbuka dan semua aset tersimpan
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching App Shell');
        // 'addAll' akan gagal jika salah satu aset tidak dapat diambil (404, dll)
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Service Worker: Cache Installation Failed', err);
      })
  );
});


// 2. PHASE ACTIVATE: Membersihkan cache lama
self.addEventListener('activate', event => {
  console.log('Service Worker: Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Hapus cache yang namanya tidak sama dengan CACHE_NAME saat ini
          if (cacheName !== CACHE_NAME) {
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


// 3. PHASE FETCH: Strategi Cache-First (Offline Mode)
self.addEventListener('fetch', event => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // Cek apakah request ada di cache
    caches.match(event.request)
      .then(response => {
        // Jika ada di cache, langsung kembalikan response dari cache
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }

        // Jika tidak ada di cache, fetch (ambil) dari jaringan
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(res => {
            // Kita bisa menambahkan respons baru ke cache di sini jika mau,
            // tapi untuk cache dasar, kita fokus pada urlsToCache.
            return res;
          })
          .catch(err => {
            // Ini akan terpanggil jika Fetch GAGAL (saat offline)
            console.error('Service Worker: Fetch failed, and no cache found.', err);
            // Di sini, kamu bisa mengembalikan halaman offline kustom jika perlu
          });
      })
  );
});