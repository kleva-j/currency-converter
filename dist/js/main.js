(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

(function() {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function(resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function(value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function(prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function() {
          return this[targetProp][prop];
        },
        set: function(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function() {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function() {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function(value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function() {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function() {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function() {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function() {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function() {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function() {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function() {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
    [ObjectStore, Index].forEach(function(Constructor) {
      // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
      if (!(funcName in Constructor.prototype)) return;

      Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function() {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function(Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function(query, count) {
      var instance = this;
      var items = [];

      return new Promise(function(resolve) {
        instance.iterateCursor(query, function(cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      if (request) {
        request.onupgradeneeded = function(event) {
          if (upgradeCallback) {
            upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
          }
        };
      }

      return p.then(function(db) {
        return new DB(db);
      });
    },
    delete: function(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());

},{}],2:[function(require,module,exports){
const idb = require('idb');

const controller = {
  init() {
    views.init();
    this.regServiceWorker();
  },

  async fetchConvRate(from, to) {
    const result = await (await fetch(`https://free.currencyconverterapi.com/api/v6/convert?q=${from}_${to}&compact=ultra`)).json();
    return result[`${from}_${to}`];
  },

  async fetchOptions() {
    let data = await fetch('http://localhost:8080/api/v1/currencies');
    let jsonData = await data.json();
    return jsonData.message;
  },

  // async convert(from, to, input, db) {
  //   const DB = await db;
  //   this.fetchFromDB(from, to, DB)
  //   .then(rate => {
  //     const results = this.calculateConversion(input, rate);
  //     if (rate) return views.render({from, to, input, results});
  //     const newRate = await (await this.fetchConvRate(from, to)).json();
  //     console.log(newRate);
  //     const newResults = this.calculateConversion(input, rate);
  //     views.render({from, to, input, newResults});     
  //     return this.saveToDB(from, to, newRate, DB);             
  //   })
  //   .then(_ => console.log(`Added ${from}-${to} to the database`))
  //   .catch(err => console.log(err));
  // },

  async convert(from, to, input, db) {
    const DB = await db;
    let results;
    const dbFetch = await this.fetchFromDB(from, to, DB);
    if (dbFetch) {
      results = this.calculateConversion(input, dbFetch);
      return views.render({ from, to, input, results });
    } else {
      const rate = await this.fetchConvRate(from, to);
      results = this.calculateConversion(input, rate);
      await this.saveToDB(from, to, rate, DB);
      return views.render({ from, to, input, results });
    }
  },

  async fetchFromDB(from, to, db) {
    const tx = db.transaction('conversion');
    const store = tx.objectStore('conversion');
    return store.get(`${from}-${to}`);
  },

  async saveToDB(from, to, amount, db) {
    const tx = await db.transaction('conversion', 'readwrite');
    const store = await tx.objectStore('conversion');
    store.put(amount, `${from}-${to}`);
    return tx.complete;
  },

  regServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service_worker.js').then(e => console.log('Service Worker Registered')).catch(err => console.log('service worker failed to register', err));
    }
  },

  createIDBDatabase() {
    const database = idb.open('newDB', 1, DB_Handle => {
      const objectStore = DB_Handle.createObjectStore('conversion');
    });
    return database;
  },

  calculateConversion(v, r) {
    const conv = v * r;
    return parseFloat(conv);
  }
};

const views = {
  init() {
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

  async renderOptions() {
    let results = await controller.fetchOptions();
    if (results) {
      results.sort((a, b) => a.id < b.id ? -1 : 1).map(val => {
        let options = val.currencySymbol ? `<option value='${val.id}'>${val.id} - ${val.currencyName} (${val.currencySymbol})</option>` : `<option value='${val.id}'>${val.id} - ${val.currencyName}</option>`;
        this.from.innerHTML += options;
        this.to.innerHTML += options;
      });
    }
  },

  render(data) {
    const { from, to, input, results } = data;
    if (results == 0) this.display.textContent = 'Please let be serious here';else this.display.textContent = `${input} ${from} = ${results} ${to}`;
  }
};

controller.init();
},{"idb":1}]},{},[2]);
