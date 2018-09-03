let cacheName = 'v2';

self.addEventListener('install', (e) => {
  console.log('[serviceWorker] Installed')

  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      console.log('caching cacheFiles');
      // console.log(cache)
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './dist/js/main.js',
        './api/v1/currencies'
      ]);
    })
  );

});

self.addEventListener('activate', (e) => {
  console.log('[serviceWorker] Activated')

  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(cacheNames.map((thisCacheName) => {
        if (thisCacheName !== cacheName){
          console.log(`[serviceWorker] Removing cached files from ${thisCacheName}`);
          return caches.delete(thisCacheName);
        }
      }));
    })
  );

});

self.addEventListener('fetch', (e) => {
  console.log('[serviceWorker] Fetching', e.request.url);

  e.respondWith(
    caches.match(e.request).then((response) => {

      if (response) {
        console.log(`[Service Worker] Found in cache ${e.request.url}`);
        return response;
      }

      let requestClone = e.request.clone();

      // async function fetchData() {
      //   try {
      //     let response = await (await fetch(requestClone)).json();
      //     let responseClone = response.clone();
      //     caches.open(cacheName).then((cache) => {
      //       cache.put(e.request, responseClone);
      //       return response;
      //     })
      //   }
      //   catch(err) {
      //     console.log('No response gotten from fetch');
      //     console.error(err);
      //   }
      //   if(!response) return response;
      // };

      // return (fetchData());

      fetch(requestClone)
        .then((response) => {
          if (!response) {
            console.log(`[Service Worker] No response from fetch`);
            return response;
          }
          let responseClone = response.clone();
          caches.open(cacheName).then((cache) => {
            cache.put(e.request, responseClone)
            return response;
          });
        })
        .catch(err => {
          console.log(`[Service Worker] Error Fetching New Data.`);
        });
    })
  );

});