if('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service_worker.js')
    .then(e => console.log('Service Worker Registered'))
  .catch(err => console.log('service worker failed to register', err));
}


//request data using fetch from currency converter api and server.

const fetchResults = async () => {
  let currencies = await fetch('http://localhost:8080/api/v1/currencies');
  // let conversionRate = await fetch(`https://free.currencyconverterapi.com/api/v6/convert?q=${from}_${to},${to}_${from}`)
  let response1 = await currencies.json();
  // let response2 = await conversionRate.json();
  const select = document.querySelectorAll('select');
  const from = select[0];
  const to = select[1];

  response1.message
    .sort((a,b) => a.currencyName > b.currencyName)
    .map(val => {
      let options = `<option value='${val.id}'>${val.id} - ${val.currencyName}</option>`;
      from.innerHTML += options;
      to.innerHTML += options;
  })
}

fetchResults();
