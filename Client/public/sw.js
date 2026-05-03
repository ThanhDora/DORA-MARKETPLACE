var CACHE_NAME = "product-images-v1";
var IMAGE_PATTERN = "/api/uploads/images/";

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
});

self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);

  if (url.pathname.startsWith(IMAGE_PATTERN)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(event.request).then(function (cachedResponse) {
          var fetchPromise = fetch(event.request)
            .then(function (networkResponse) {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(function () {
              return cachedResponse;
            });

          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
