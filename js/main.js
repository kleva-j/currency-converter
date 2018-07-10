if('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service_worker.js', {scope: './'})
    .then(() => {
      console.log('Service Worker Registered')
  })
  .catch(err => {
    console.log('service worker failed to register', err)
  });
}
