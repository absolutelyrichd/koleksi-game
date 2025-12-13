// ... (Bagian CACHE_STATIC, CACHE_DYNAMIC, urlsToCache, INSTALL, dan ACTIVATE tetap sama) ...

// ==========================================================
// 4. PHASE FETCH: Caching Strategy (Stale-While-Revalidate dengan Fallback)
// ==========================================================

// Cache statis hanya untuk satu halaman fallback (misalnya index.html)
const FALLBACK_PAGE = '/'; 

self.addEventListener('fetch', event => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Jika request adalah aset statis yang di-cache-first (App Shell)
  if (urlsToCache.includes(requestUrl.pathname)) {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Jika aset statis ada di cache, langsung kembalikan.
                if (response) return response;
                // Jika aset statis tidak ada (kasus langka), fetch dari network.
                return fetch(event.request);
            })
    );
    return;
  }
  
  // Jika request adalah aset dinamis/API (Stale-While-Revalidate)
  event.respondWith(
    caches.open(CACHE_DYNAMIC).then(cache => {
      // 1. Cek cache (respons cepat dari "Stale" data)
      return cache.match(event.request).then(response => {
        
        // 2. Selalu coba fetch dari network di background (Revalidate)
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(err => {
             console.error('Service Worker: Fetch failed. Returning Cache or Fallback.', err);
             
             // --- KRUSIAL: BLOK FALLBACK OFFLINE ---
             // Jika Fetch gagal (karena offline), kembalikan response dari cache 
             // jika itu adalah request navigasi (halaman HTML).
             if (event.request.mode === 'navigate') {
                 // Untuk request navigasi (saat user buka URL baru), kembalikan index.html dari cache.
                 return caches.match(FALLBACK_PAGE); 
             }
             // Untuk aset lain (gambar/data API), kita biarkan fetchPromise mengembalikan undefined, 
             // dan kode di bawah akan mencoba cache.
             
             // Agar tidak ada ERR_FAILED, pastikan ada return di sini, 
             // walaupun hanya untuk mencegah error.
             return; 
             // ------------------------------------
          });

        // Kembalikan response dari cache jika ada, ATAU tunggu fetch network.
        // Jika response (dari cache) ada, ia akan langsung dikembalikan
        return response || fetchPromise;
      });
    })
  );
});