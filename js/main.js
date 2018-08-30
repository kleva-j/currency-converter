if('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service_worker.js')
    .then(e => console.log('Service Worker Registered'))
  .catch(err => console.log('service worker failed to register', err));
}


//request data using fetch from currency converter api anggfghnnnd server.

const fetchResults = async () => {
  let currencies = await ( await fetch('http://localhost:8080/api/v1/currencies')).json();
  const select = document.querySelectorAll('select');
  const from = select[0];
  const to = select[1];
  // let conversionRate = await ( await fetch(`https://free.currencyconverterapi.com/api/v6/convert?q=${from}_${to},${to}_${from}`)).json();

  currencies.message
    .sort((a,b) => a.id[0] > b.id[0])
    .map(val => {
      let options = val.currencySymbol
       ? `<option value='${val.id}'>${val.id} - ${val.currencyName} (${val.currencySymbol})</option>` 
       : `<option value='${val.id}'>${val.id} - ${val.currencyName}</option>`
      from.innerHTML += options;
      to.innerHTML += options;
  })
}

fetchResults();
