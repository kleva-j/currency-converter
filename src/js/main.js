const idb = require('idb');

const controller = {
  init(){
    views.init();
    this.regServiceWorker();    
  },

  fetchConvRate(from, to) {
    // let rate = await fetch(`https://free.currencyconverterapi.com/api/v6/convert?q=${from}_${to}&compact=ultra`);
    
    // return (await rate.json());
    return 360;
  },

  async fetchOptions() {
    let data = await fetch('http://localhost:8080/api/v1/currencies');
    let jsonData = await data.json();
    return jsonData.message;
  },

  async convert(from, to, input, db) {
    const DB = await db;
    this.fetchFromDB(from, to, DB)
    .then(rate => {
      const results = this.calculateConversion(input, rate);
      if (rate) {        
        console.log(input, results);
        return views.render({from, to, input, results});
      }
      const newRate = this.fetchConvRate(from, to);
      views.render({from, to, input, results});     
      return this.saveToDB(from, to, newRate, DB);             
    })
    .then(_ => console.log(`Added ${from}-${to} to the database`))
    .catch(err => console.log(err));
  },

  async fetchFromDB(from, to, db) {
    const tx = db.transaction('conversion');
    const store = tx.objectStore('conversion');
    return store.get(`${from}-${to}`);
  },
  
  async saveToDB(from, to, amount, db) { 
    const tx = await db.transaction('conversion','readwrite');
    const store = await tx.objectStore('conversion');
    store.put(amount,`${from}-${to}`);
    return tx.complete;
  },

  regServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('./service_worker.js')
        .then(e => console.log('Service Worker Registered'))
        .catch(err => console.log('service worker failed to register', err));
    }
  },

  createIDBDatabase() {
    const database = idb.open('newDB', 1, DB_Handle => {
      const objectStore = DB_Handle.createObjectStore('conversion');
    });
    return database;
  },

  calculateConversion(v,r) {        
    const conv = v * r;
    return parseFloat(conv);
  }
}

const views = {
  init(){
    this.display = document.querySelector('#display');
    const select = document.querySelectorAll('select');
    this.from = select[0];
    this.to = select[1];
    const form = document.querySelector('form');

    const DB = controller.createIDBDatabase();
    
    form.onsubmit = e => {
      e.preventDefault();
      const number = document.querySelector('#number').value;
      const amount = number ? parseInt(number) : 0;
      controller.convert(this.from.value, this.to.value, amount, DB);
    };
    this.renderOptions();
  },

  async renderOptions(){
    let results = await controller.fetchOptions();
    if (results) {
      results
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map(val => {
          let options = val.currencySymbol
            ? `<option value='${val.id}'>${val.id} - ${val.currencyName} (${val.currencySymbol})</option>` 
            : `<option value='${val.id}'>${val.id} - ${val.currencyName}</option>`;
            this.from.innerHTML += options;
            this.to.innerHTML += options;
      });
    }
  },

  render(data) {
    const {from, to, input, results} = data;
    if(results == 0) this.display.textContent = 'Please let be serious here';
    else this.display.textContent = `${input} ${from} = ${results} ${to}`    
  }
}

controller.init();