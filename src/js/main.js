const idb = require('idb');

const controller = {
  init(){
    views.init();
    this.regServiceWorker();    
  },

  async fetchFromNetwork(from, to) {
    try {
      const fetchRate = await fetch(`https://free.currencyconverterapi.com/api/v6/convert?q=${from}_${to}&compact=ultra`);
      const results = await fetchRate.json();
      return results[`${from}_${to}`];
    }
    catch(err) {
      console.log(err);
      return;
    } 
  },

  async fetchOptions() {
    let data = await fetch('https://free.currencyconverterapi.com/api/v5/currencies');
    let jsonData = await data.json();
    return (Object.values(jsonData.results));
  }, 

  async convert(from, to, input, db) {
    const DB = await db;
    let results;
    if(from == to) {
      results = input;
      return views.render({from, to, input, results});
    }
    const dbFetch = await this.fetchFromDB(from, to, DB);
    if(dbFetch) {
      results = this.calculateConversion(input, dbFetch);
      return views.render({from, to, input, results});
    }
    else {
      const rate = await this.fetchFromNetwork(from, to);
      if(rate) {
        results = this.calculateConversion(input, rate);
        await this.saveToDB(from, to, rate, DB).catch(console);
        return views.render({from, to, input, results});  
      }
      else return views.renderError();
    }
  },

  async fetchFromDB(from, to, db) {
    const tx = db.transaction('conversion');
    const store = tx.objectStore('conversion');
    return store.get(`${to}-${from}`) || store.get(`${from}-${to}`);
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
    this.alertbox = document.querySelector('.alert');
    this.from = select[0];
    this.to = select[1];
    const form = document.querySelector('form');

    const DB = controller.createIDBDatabase();
     
    form.onsubmit = e => {
      e.preventDefault();
      this.renderLoader('add');
      const number = document.querySelector('#number').value;
      const amount = number ? parseInt(number) : 1;
      controller.convert(this.from.value, this.to.value, amount, DB).catch(console.log);      
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

  renderLoader(str){
    if (str == 'add') {
      this.alertbox.classList.add('show');
      this.alertbox.innerHTML = `<span></span>`; 
      document.querySelector('span').classList.add('load');
    }
    else if (str == 'remove') {
      this.alertbox.classList.remove('show');
    }
  },

  renderError(){
    const remove = () => this.renderLoader('remove');
    this.alertbox.innerHTML =`<div class="errmsg">
                                <p>Oops, something went wrong</p>
                                <button id="reload">Try again</button>  
                              </div>`;
    document.querySelector('#reload').addEventListener('click', remove);
  },

  render(data) {
    this.renderLoader('remove');
    const {from, to, input, results} = data;
    if(results == 0 || !from || !to) this.display.textContent = 'Please let be serious here';
    else this.display.textContent = `${input} ${from} = ${results} ${to}`;
    this.renderLoader();
  }
}

controller.init();