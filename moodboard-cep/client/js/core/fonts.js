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
    defaultFont: 'Georgia',
    /* v1.8 — favoris : filtre du popover de polices. Persistés dans
     * prefs.json (clé fontFavs) — communs à l'application et à
     * l'extension, indépendants du moodboard ouvert. */
    favorites: {},
    /* v1.18 — GRAISSES réelles par famille ({ family: [100…900] }),
     * connues quand l'hôte énumère les FACES (Electron queryLocalFonts,
     * Illustrator app.textFonts). Null côté web → le sélecteur de
     * graisse propose la gamme CSS standard. */
    weights: null
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

  function applyList(names, source, weights) {
    var list = dedupeAndSort(names);
    if (!list.length) return;
    state.list = list;
    state.source = source;
    state.weights = weights && Object.keys(weights).length ? weights : null;
    resolveWaiters();
    emitChange();
  }

  /* v1.18 — nom de graisse (« SemiBold Italic », « Bold Oblique »…)
   * → poids CSS 100…900. Les variantes penchées n'influencent pas le
   * poids ; les tokens longs sont testés AVANT leurs sous-chaînes
   * (« extrabold » avant « bold », « semibold » avant « bold »). */
  function weightFromStyle(style) {
    var s = String(style || '').toLowerCase();
    if (!s || s === 'regular' || s === 'normal' || s === 'roman' || s === 'book') return 400;
    var italic = s.indexOf('italic') >= 0 || s.indexOf('oblique') >= 0;
    if (italic) {
      s = s.replace(/italic|oblique/g, '').trim();
      if (!s || s === 'regular' || s === 'normal') return 400;
    }
    if (s.indexOf('thin') >= 0 || s.indexOf('hairline') >= 0) return 100;
    if (s.indexOf('extralight') >= 0 || s.indexOf('extra-light') >= 0 ||
        s.indexOf('ultralight') >= 0 || s.indexOf('ultra-light') >= 0) return 200;
    if (s.indexOf('light') >= 0) return 300;
    if (s.indexOf('medium') >= 0) return 500;
    if (s.indexOf('semibold') >= 0 || s.indexOf('semi-bold') >= 0 ||
        s.indexOf('demibold') >= 0 || s.indexOf('semi bold') >= 0 ||
        s.indexOf('demi bold') >= 0) return 600;
    if (s.indexOf('extrabold') >= 0 || s.indexOf('extra-bold') >= 0 ||
        s.indexOf('extra bold') >= 0 || s.indexOf('ultrabold') >= 0 ||
        s.indexOf('heavy') >= 0) return 800;
    if (s.indexOf('black') >= 0) return 900;
    if (s.indexOf('bold') >= 0) return 700;
    return 400;
  }

  /* Accumule les poids par famille à partir des faces énumérées. */
  function collectWeights(pairs) {
    var map = {};
    for (var i = 0; i < pairs.length; i++) {
      var fam = String(pairs[i][0] || '').trim();
      if (!fam) continue;
      var w = weightFromStyle(pairs[i][1]);
      if (!map[fam]) map[fam] = {};
      map[fam][w] = true;
    }
    var out = {};
    Object.keys(map).forEach(function (f) {
      out[f] = Object.keys(map[f]).map(Number).sort(function (a, b) { return a - b; });
    });
    return out;
  }

  /* --------------------------- énumérations --------------------------- */

  function fromDesktop() {
    if (typeof window.queryLocalFonts !== 'function') return false;
    /* Electron : permission 'local-fonts' accordée par le processus
     * principal. En cas de refus/refi, on retombe sur la liste web.
     * v1.18 — chaque FACE porte son style : les graisses réelles de
     * chaque famille sont collectées pour le sélecteur de graisse. */
    window
      .queryLocalFonts()
      .then(function (fonts) {
        var fams = [];
        var faces = [];
        var seen = {};
        for (var i = 0; i < fonts.length; i++) {
          var f = fonts[i].family;
          if (f && !seen[f]) { seen[f] = 1; fams.push(f); }
          faces.push([f, fonts[i].style]);
        }
        applyList(
          fams.length ? fams : FALLBACK,
          fams.length ? 'system' : 'fallback',
          fams.length ? collectWeights(faces) : null
        );
      })
      .catch(function () {
        applyList(FALLBACK, 'fallback');
      });
    return true;
  }

  function fromCep() {
    if (!MB.cep || !MB.cep.available()) return false;
    /* v1.18 — renvoie « famille\u0002style » par face (le style donne
     * la graisse) ; le séparateur \u0001 sépare les faces. */
    var script =
      '(function(){try{var t=app.textFonts,o=[],s={};' +
      'for(var i=0;i<t.length;i++){var f=t[i].family,st=t[i].style||"Regular";' +
      'o.push(f+String.fromCharCode(2)+st);' +
      'if(f&&!s[f]){s[f]=1}}' +
      'return o.join(String.fromCharCode(1))}catch(e){return "ERR"}})()';
    MB.cep
      .evalScript(script)
      .then(function (result) {
        var raw = String(result || '');
        if (!raw || raw === 'ERR' || raw.indexOf('ERR') === 0) {
          applyList(FALLBACK, 'fallback');
          return;
        }
        var parts = raw.split('\u0001');
        var fams = [];
        var faces = [];
        var seen = {};
        for (var i = 0; i < parts.length; i++) {
          var pair = parts[i].split('\u0002');
          var f = String(pair[0] || '').trim();
          if (!f) continue;
          if (!seen[f]) { seen[f] = 1; fams.push(f); }
          faces.push([f, pair[1]]);
        }
        applyList(fams.length ? fams : FALLBACK, 'host', fams.length ? collectWeights(faces) : null);
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
    /* v1.8 — favoris persistés (liste de noms de familles). */
    if (p && Array.isArray(p.fontFavs)) {
      var map = {};
      for (var i = 0; i < p.fontFavs.length; i++) {
        if (p.fontFavs[i]) map[String(p.fontFavs[i])] = true;
      }
      state.favorites = map;
    }
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

  /* ------------------------------ favoris (v1.8) --------------------- */

  function saveFavorites() {
    var arr = Object.keys(state.favorites);
    if (MB.storage.setPref) MB.storage.setPref('fontFavs', arr);
  }

  function isFavorite(name) {
    return !!state.favorites[String(name)];
  }

  function toggleFavorite(name) {
    var n = String(name || '').trim();
    if (!n) return false;
    if (state.favorites[n]) delete state.favorites[n];
    else state.favorites[n] = true;
    saveFavorites();
    emitChange();
    return !!state.favorites[n];
  }

  function favoriteList() {
    /* favoris triés comme la liste courante (ordre alphabétique),
     * les familles disparues de la liste sont conservées quand même
     * (la police peut revenir avec une autre source). */
    return Object.keys(state.favorites).sort(function (a, b) {
      return a.localeCompare(b, 'fr', { sensitivity: 'base' });
    });
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
    /* v1.18 — graisses RÉELLES d'une famille (table triée 100…900) ou
     * null si l'hôte ne les expose pas : le sélecteur de graisse
     * retombe alors sur la gamme CSS standard. */
    weightsFor: function (family) {
      if (!state.weights || !family) return null;
      var w = state.weights[String(family)];
      return w && w.length ? w.slice() : null;
    },
    weightFromStyle: weightFromStyle,
    /* v1.8 — favoris de polices (filtre du popover). */
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    favorites: favoriteList,
    hasAnyFavorite: function () {
      return Object.keys(state.favorites).length > 0;
    },
    onChange: function (fn) {
      listeners.push(fn);
      return fn;
    },
    FALLBACK: FALLBACK
  };
})();
