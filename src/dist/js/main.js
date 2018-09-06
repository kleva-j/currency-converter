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
'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var idb = require('idb');

var controller = {
  init: function init() {
    views.init();
    this.regServiceWorker();
  },
  fetchFromNetwork: function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(from, to) {
      var fetchRate, results;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;
              _context.next = 3;
              return fetch('https://free.currencyconverterapi.com/api/v6/convert?q=' + from + '_' + to + '&compact=ultra');

            case 3:
              fetchRate = _context.sent;
              _context.next = 6;
              return fetchRate.json();

            case 6:
              results = _context.sent;
              return _context.abrupt('return', results[from + '_' + to]);

            case 10:
              _context.prev = 10;
              _context.t0 = _context['catch'](0);

              console.log(_context.t0);
              return _context.abrupt('return');

            case 14:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this, [[0, 10]]);
    }));

    function fetchFromNetwork(_x, _x2) {
      return _ref.apply(this, arguments);
    }

    return fetchFromNetwork;
  }(),
  fetchOptions: function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
      var data, jsonData;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _context2.next = 2;
              return fetch('https://free.currencyconverterapi.com/api/v5/currencies');

            case 2:
              data = _context2.sent;
              _context2.next = 5;
              return data.json();

            case 5:
              jsonData = _context2.sent;
              return _context2.abrupt('return', Object.values(jsonData.results));

            case 7:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, this);
    }));

    function fetchOptions() {
      return _ref2.apply(this, arguments);
    }

    return fetchOptions;
  }(),
  convert: function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(from, to, input, db) {
      var DB, results, dbFetch, rate;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return db;

            case 2:
              DB = _context3.sent;
              results = void 0;

              if (!(from == to)) {
                _context3.next = 7;
                break;
              }

              results = input;
              return _context3.abrupt('return', views.render({ from: from, to: to, input: input, results: results }));

            case 7:
              _context3.next = 9;
              return this.fetchFromDB(from, to, DB);

            case 9:
              dbFetch = _context3.sent;

              if (!dbFetch) {
                _context3.next = 15;
                break;
              }

              results = this.calculateConversion(input, dbFetch);
              return _context3.abrupt('return', views.render({ from: from, to: to, input: input, results: results }));

            case 15:
              _context3.next = 17;
              return this.fetchFromNetwork(from, to);

            case 17:
              rate = _context3.sent;

              if (!rate) {
                _context3.next = 25;
                break;
              }

              results = this.calculateConversion(input, rate);
              _context3.next = 22;
              return this.saveToDB(from, to, rate, DB).catch(console);

            case 22:
              return _context3.abrupt('return', views.render({ from: from, to: to, input: input, results: results }));

            case 25:
              return _context3.abrupt('return', views.renderError());

            case 26:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));

    function convert(_x3, _x4, _x5, _x6) {
      return _ref3.apply(this, arguments);
    }

    return convert;
  }(),
  fetchFromDB: function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(from, to, db) {
      var tx, store;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              tx = db.transaction('conversion');
              store = tx.objectStore('conversion');
              return _context4.abrupt('return', store.get(from + '-' + to));

            case 3:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, this);
    }));

    function fetchFromDB(_x7, _x8, _x9) {
      return _ref4.apply(this, arguments);
    }

    return fetchFromDB;
  }(),
  saveToDB: function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(from, to, amount, db) {
      var tx, store;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return db.transaction('conversion', 'readwrite');

            case 2:
              tx = _context5.sent;
              _context5.next = 5;
              return tx.objectStore('conversion');

            case 5:
              store = _context5.sent;

              store.put(amount, from + '-' + to);
              return _context5.abrupt('return', tx.complete);

            case 8:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, this);
    }));

    function saveToDB(_x10, _x11, _x12, _x13) {
      return _ref5.apply(this, arguments);
    }

    return saveToDB;
  }(),
  regServiceWorker: function regServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service_worker.js').then(function (e) {
        return console.log('Service Worker Registered');
      }).catch(function (err) {
        return console.log('service worker failed to register', err);
      });
    }
  },
  createIDBDatabase: function createIDBDatabase() {
    var database = idb.open('newDB', 1, function (DB_Handle) {
      var objectStore = DB_Handle.createObjectStore('conversion');
    });
    return database;
  },
  calculateConversion: function calculateConversion(v, r) {
    var conv = v * r;
    return parseFloat(conv);
  }
};

var views = {
  init: function init() {
    var _this = this;

    this.display = document.querySelector('#display');
    var select = document.querySelectorAll('select');
    this.alertbox = document.querySelector('.alert');
    this.from = select[0];
    this.to = select[1];
    var form = document.querySelector('form');

    var DB = controller.createIDBDatabase();

    form.onsubmit = function (e) {
      e.preventDefault();
      _this.renderLoader('add');
      var number = document.querySelector('#number').value;
      var amount = number ? parseInt(number) : 1;
      controller.convert(_this.from.value, _this.to.value, amount, DB).catch(console.log);
    };
    this.renderOptions();
  },
  renderOptions: function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
      var _this2 = this;

      var results;
      return regeneratorRuntime.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              _context6.next = 2;
              return controller.fetchOptions();

            case 2:
              results = _context6.sent;

              if (results) {
                results.sort(function (a, b) {
                  return a.id < b.id ? -1 : 1;
                }).map(function (val) {
                  var options = val.currencySymbol ? '<option value=\'' + val.id + '\'>' + val.id + ' - ' + val.currencyName + ' (' + val.currencySymbol + ')</option>' : '<option value=\'' + val.id + '\'>' + val.id + ' - ' + val.currencyName + '</option>';
                  _this2.from.innerHTML += options;
                  _this2.to.innerHTML += options;
                });
              }

            case 4:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, this);
    }));

    function renderOptions() {
      return _ref6.apply(this, arguments);
    }

    return renderOptions;
  }(),
  renderLoader: function renderLoader(str) {
    if (str == 'add') {
      this.alertbox.classList.add('show');
      this.alertbox.innerHTML = '<span></span>';
      document.querySelector('span').classList.add('load');
    } else if (str == 'remove') this.alertbox.classList.remove('show');
  },
  renderError: function renderError() {
    var _this3 = this;

    var remove = function remove() {
      return _this3.renderLoader('remove');
    };
    this.alertbox.innerHTML = '<div class="errmsg">\n                                <p>Oops, something went wrong</p>\n                                <button id="reload">Try again</button>  \n                              </div>';
    document.querySelector('#reload').addEventListener('click', remove);
  },
  render: function render(data) {
    this.renderLoader('remove');
    var from = data.from,
        to = data.to,
        input = data.input,
        results = data.results;

    if (results == 0) this.display.textContent = 'Please let be serious here';else this.display.textContent = input + ' ' + from + ' = ' + results + ' ' + to;
    this.renderLoader();
  }
};

controller.init();
},{"idb":1}]},{},[2]);
