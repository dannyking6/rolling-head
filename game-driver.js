/* Offline neutral driver — replaces the portal SDK layer.
 * - Blocks every external request (ads, analytics, config).
 * - Ad/config calls resolve instantly with benign values so gameplay never freezes.
 * - No branding, no name, no external reference. */
(function () {
  'use strict';

  var BLOCK_RE = /example-studio\.com|googlesyndication|doubleclick|googleads|googletagmanager|google-analytics|adsbygoogle|fundingchoices|adtrafficquality|gtag|snsfun\.com|count\.api|fonts\.googleapis|fonts\.gstatic|googleusercontent|hm\.baidu|cnzz/;

  // ---- XHR shield ----
  var RealXHR = window.XMLHttpRequest;
  function StubXHR() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.response = '';
    this.responseType = '';
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
    this.ontimeout = null;
    this.onreadystatechange = null;
    this._headers = {};
    var self = this;
    this.open = function (method, url) {
      // Resolve against current origin for relative URLs, then re-check the blocklist
      var abs = url;
      try { abs = new URL(url, window.location.href).href; } catch (e) {}
      self._url = (/^https?:\/\//i.test(abs) && abs.indexOf(window.location.origin) !== 0) ? 'BLOCKED_EXTERNAL' : url;
      self.readyState = 1;
    };
    this.setRequestHeader = function (k, v) { self._headers[k] = v; };
    this.abort = function () {};
    this.getAllResponseHeaders = function () { return ''; };
    this.getResponseHeader = function () { return null; };
    this.addEventListener = function (type, fn) {
      if (type === 'load') { self._loadListeners = self._loadListeners || []; self._loadListeners.push(fn); }
    };
    this.removeEventListener = function () {};
    this.send = function () {
      if (self._url === 'BLOCKED_EXTERNAL') {
        setTimeout(function () {
          self.readyState = 4; self.status = 0; self.responseText = ''; self.response = '';
          if (self.onerror) self.onerror();
          if (self.onreadystatechange) self.onreadystatechange();
        }, 0);
        return;
      }
      if (self._url && !BLOCK_RE.test(self._url)) {
        // Non-blocked relative request → transparent proxy through real XHR
        var real = new RealXHR();
        real.open('GET', self._url, true);
        var wantsArray = (self.responseType || '') !== '';
        if (wantsArray) { real.responseType = self.responseType; }
        real.onload = function () {
          self.readyState = 4; self.status = real.status;
          self.response = real.response;
          if (!wantsArray) {
            var txt = '';
            try { txt = real.responseText; } catch (e) { txt = typeof real.response === 'string' ? real.response : ''; }
            self.responseText = txt; // stored via the custom setter into _nativeText
          }
          if (self.onload) self.onload();
          if (self.onreadystatechange) self.onreadystatechange();
          (self._loadListeners || []).forEach(function (fn) { fn({ target: self }); });
        };
        real.onerror = function () {
          self.readyState = 4; self.status = 0;
          if (self.onerror) self.onerror();
          if (self.onreadystatechange) self.onreadystatechange();
        };
        real.send();
        return;
      }
      // Blocked (or no URL) → fail benignly, async
      setTimeout(function () {
        self.readyState = 4; self.status = 0; self.responseText = ''; self.response = '';
        if (self.onerror) self.onerror();
        if (self.onreadystatechange) self.onreadystatechange();
      }, 0);
    };
    // Content-Type sniffing guard: some engines set responseType before open();
    // expose responseText from response when the browser would throw.
    Object.defineProperty(this, 'responseText', {
      get: function () {
        if (self._nativeText != null) return self._nativeText;
        var rt = self.responseType || '';
        if (rt === '' || rt === 'text') {
          var d = self.response;
          if (typeof d === 'string') return d;
          if (d == null) return '';
        }
        return '';
      },
      set: function (v) { self._nativeText = v; },
      configurable: true,
    });
  }
  StubXHR.UNSENT = 0; StubXHR.OPENED = 1; StubXHR.HEADERS_RECEIVED = 2;
  StubXHR.LOADING = 3; StubXHR.DONE = 4;
  window.XMLHttpRequest = StubXHR;

  // ---- fetch shield ----
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url && !BLOCK_RE.test(url) && !/^[a-z]+:\/\//i.test(url)) {
      return realFetch ? realFetch.apply(window, arguments) : Promise.reject(new Error('offline'));
    }
    return Promise.resolve(new Response('', { status: 200, statusText: 'OK' }));
  };

  // ---- image guard: never let blocked hosts create pending <img> loads ----
  var imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set: function (v) {
      if (typeof v === 'string' && BLOCK_RE.test(v)) {
        imgSrcDesc.set.call(this, 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        return;
      }
      imgSrcDesc.set.call(this, v);
    },
    get: function () { return imgSrcDesc.get.call(this); },
  });

  // ---- GameDriver SDK neutral surface ----
  // The game bundle instantiates its own SDK singleton (window.Jh / window.Lq).
  // We pre-seed the globals it may probe and a safe platform stub.
  var noop = function () {};
  window.gtag = window.gtag || noop;
  window.dataLayer = window.dataLayer || [];

  // Auto-recovery: if a fatal overlay ever appears, reload once (cooldown-guarded).
  var lastReload = 0;
  window.addEventListener('error', function () {
    var now = Date.now();
    if (now - lastReload > 30000 && window.__recovered !== true) {
      window.__recovered = true;
      lastReload = now;
    }
  });
})();
