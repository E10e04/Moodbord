/* =========================================================================
 * fonts.js — Polices du système + police par défaut (v1.6).
 *
 * « Toutes les polices disponibles sur l'ordinateur de l'utilisateur » :
 *  - Application de bureau (Electron) : Local Font Access
 *    (window.queryLocalFonts — permission 'local-fonts' accordée par le
 *    processus principal) ;
 *  - Extension CEP (Illustrator) : énumération des TextFonts de l'hôte
 *    via evalScript (app.textFonts) ;
 *  - Aperçu navigateur / repli : liste web-safe curatée.
 *
 * La police PAR DÉFAUT (utilisée pour tout nouveau texte/note) est
 * persistée dans prefs (storage) et exposée via MB.fonts.default().
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var FALLBACK = [
    'Arial', 'Arial Black', 'Arial Narrow', 'Bookman Old Style', 'Calibri',
    'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia',
    'Corbel', 'Courier New', 'Georgia', 'Garamond', 'Helvetica',
    'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Palatino Linotype',
    'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
  ];

  var state = {
    list: [],
    source: 'fallback',
    ready: false,
    defaultFont: 'Georgia'
  };

  var waiters = [];
  var listeners = [];

  function emitChange() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](); } catch (e) { /* jamais bloquant */ }
    }
  }

  function resolveWaiters() {
    state.ready = true;
    for (var i = 0; i < waiters.length; i++) {
      try { waiters[i](); } catch (e) { /* noop */ }
    }
    waiters = [];
  }

  function dedupeAndSort(names) {
    var seen = {};
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var n = String(names[i] || '').trim();
      if (!n || seen[n.toLowerCase()]) continue;
      seen[n.toLowerCase()] = true;
      out.push(n);
    }
    out.sort(function (a, b) {
      return a.localeCompare(b, 'fr', { sensitivity: 'base' });
    });
    return out;
  }

  function applyList(names, source) {
    var list = dedupeAndSort(names);
    if (!list.length) return;
    state.list = list;
    state.source = source;
    resolveWaiters();
    emitChange();
  }

  /* --------------------------- énumérations --------------------------- */

  function fromDesktop() {
    if (typeof window.queryLocalFonts !== 'function') return false;
    /* Electron : permission 'local-fonts' accordée par le processus
     * principal. En cas de refus/refi, on retombe sur la liste web. */
    window
      .queryLocalFonts()
      .then(function (fonts) {
        var fams = [];
        for (var i = 0; i < fonts.length; i++) fams.push(fonts[i].family);
        applyList(fams.length ? fams : FALLBACK, fams.length ? 'system' : 'fallback');
      })
      .catch(function () {
        applyList(FALLBACK, 'fallback');
      });
    return true;
  }

  function fromCep() {
    if (!MB.cep || !MB.cep.available()) return false;
    var script =
      '(function(){try{var t=app.textFonts,o=[],s={};' +
      'for(var i=0;i<t.length;i++){var f=t[i].family;' +
      'if(f&&!s[f]){s[f]=1;o.push(f)}}' +
      'return o.join(String.fromCharCode(1))}catch(e){return "ERR"}})()';
    MB.cep
      .evalScript(script)
      .then(function (result) {
        var raw = String(result || '');
        if (!raw || raw === 'ERR' || raw.indexOf('ERR') === 0) {
          applyList(FALLBACK, 'fallback');
          return;
        }
        applyList(raw.split('\u0001'), 'host');
      })
      .catch(function () {
        applyList(FALLBACK, 'fallback');
      });
    return true;
  }

  function enumerate() {
    if (fromCep()) return;
    if (fromDesktop()) return;
    applyList(FALLBACK, 'fallback');
  }

  /* ------------------------------ défaut ------------------------------ */

  function loadDefault() {
    var p = MB.storage.prefs ? MB.storage.prefs() : null;
    var f = p && typeof p.defaultFont === 'string' ? p.defaultFont : '';
    if (f) state.defaultFont = f;
  }

  function saveDefault() {
    if (MB.storage.setPref) {
      MB.storage.setPref('defaultFont', state.defaultFont);
    }
  }

  function setDefault(name) {
    var f = String(name || '').trim();
    if (!f) return;
    state.defaultFont = f;
    saveDefault();
    emitChange();
    if (MB.ui && MB.ui.toast) {
      MB.ui.toast('Police par défaut : ' + f, 'success');
    }
  }

  function isDefault(name) {
    return String(name).toLowerCase() === state.defaultFont.toLowerCase();
  }

  /* ------------------------------ publics ------------------------------ */

  function whenReady(fn) {
    if (state.ready) {
      fn();
      return;
    }
    waiters.push(fn);
    /* Filet : l'énumération échoue silencieusement → liste web après 4 s. */
    setTimeout(function () {
      if (!state.ready) applyList(FALLBACK, 'fallback');
    }, 4000);
  }

  function init() {
    loadDefault();
    /* lancer l'énumération au prochain tick : le boot n'est pas bloqué,
     * le premier popover attend whenReady(). */
    setTimeout(enumerate, 60);
  }

  MB.fonts = {
    init: init,
    whenReady: whenReady,
    refresh: enumerate,
    list: function () {
      return state.list.slice();
    },
    source: function () {
      return state.source;
    },
    isReady: function () {
      return state.ready;
    },
    default: function () {
      return state.defaultFont;
    },
    setDefault: setDefault,
    isDefault: isDefault,
    onChange: function (fn) {
      listeners.push(fn);
      return fn;
    },
    FALLBACK: FALLBACK
  };
})();
