/* =========================================================================
 * utils.js — Aides transverses (géométrie, couleurs, DOM, divers).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  /* Version affichée dans la barre d'état, la boîte « À propos » et le
   * rapport de diagnostic — LA référence pour vérifier que le panneau
   * exécuté est bien la dernière installation. */
  MB.VERSION = '1.8.0';

  /* ---------- Événements adaptatifs (pointer + souris) ----------
   *
   * Contexte : certains moteurs CEP (Illustrator selon version/hôte)
   * livrent mal — voire pas du tout — les événements pointer de BOUTON
   * (pointerdown=0, pointerup=0) alors que pointermove circule et que
   * la famille souris fonctionne. Le symptôme typique : le zoom molette
   * marche, les clics sur boutons marchent, mais tout drag rate.
   *
   * On branche donc LES DEUX familles sur les mêmes handlers :
   *  - un événement souris de nature N est ignoré si un événement
   *    pointer DE MÊME NATURE N vient d'arriver (Chromium émet la
   *    paire pointer puis souris-de-compatibilité dans la même
   *    impulsion) ;
   *  - si le flux pointer de cette nature meurt, la couche souris
   *    prend automatiquement le relais.
   *
   *  IMPORTANT (v1.2.0) : la couverture est PAR NATURE d'événement.
   *   L'ancienne couverture globale (n'importe quel événement pointer
   *   récent masquait n'importe quel événement souris) laissait un
   *   pointermove masquer un mouseup : dans un moteur CEP qui livre
   *   pointermove mais PAS pointerup, TOUT mouseup en fin de drag —
   *   c'est-à-dire précisément quand la souris bouge encore — était
   *   avalé : drags bibliothèque/outils qui ne se posent jamais,
   *   gestes canvas qui fuient (mesuré v1.1.3 : ghostStart=9,
   *   ghostDrop=4, ghostCancel=0).
   *
   * MB.EVT_DIAG compte les événements bruts reçus de chaque famille —
   * UNE SEULE FOIS par événement (comptage centralisé en capture,
   * indépendant du nombre de modules qui écoutent) — diagnostic
   * direct dans la console DevTools : MB.interact.diag(). */

  function isTextField(node) {
    return !!(
      node &&
      (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)
    );
  }

  var lastPointerTs = { down: -1e9, move: -1e9, up: -1e9 };
  var POINTER_COVER_MS = 50;
  var EVT_DIAG = {
    pointerdown: 0, pointermove: 0, pointerup: 0, pointercancel: 0,
    mousedown: 0, mousemove: 0, mouseup: 0, dragstartBlocked: 0, blur: 0,
    keydown: 0, keyup: 0, focusInInput: 0,
    ghostStart: 0, ghostDrop: 0, ghostCancel: 0,
    focus: 0, wheel: 0
  };
  MB.EVT_DIAG = EVT_DIAG;

  function pointerCovers(kind) {
    var ts = lastPointerTs[kind];
    return typeof ts === 'number' && Date.now() - ts < POINTER_COVER_MS;
  }

  function bindPointerWithMouse(target, kind, handler, useCapture) {
    var cap = !!useCapture;
    target.addEventListener('pointer' + kind, function (e) {
      lastPointerTs[kind] = Date.now();
      handler(e);
    }, cap);
    target.addEventListener('mouse' + kind, function (e) {
      // Un mouseup n'est masqué que par un pointerup récent — jamais
      // par un pointermove (cf. en-tête de section).
      if (pointerCovers(kind)) return; // déjà couvert par l'événement pointer
      handler(e);
    }, cap);
  }

  /* Comptage brut centralisé : un événement = +1, quel que soit le
     nombre de modules qui l'écoutent. Capture sur window : on voit
     tout, y compris ce que des enfants interrompraient. Les anciens
     rapports comptaient double/triple (mouseup≈2×mousedown) car chaque
     bindPointerWithMouse incrémentait de son côté. */
  (function tapEvents() {
    ['down', 'move', 'up'].forEach(function (k) {
      window.addEventListener('pointer' + k, function () {
        EVT_DIAG['pointer' + k]++;
      }, true);
      window.addEventListener('mouse' + k, function () {
        EVT_DIAG['mouse' + k]++;
      }, true);
    });
    window.addEventListener('pointercancel', function () {
      EVT_DIAG.pointercancel++;
    }, true);
    window.addEventListener('blur', function () {
      EVT_DIAG.blur++;
    }, true);
    window.addEventListener('focus', function () {
      EVT_DIAG.focus++;
    }, true);
    window.addEventListener('wheel', function () {
      EVT_DIAG.wheel++;
    }, { capture: true, passive: true });
    window.addEventListener('keydown', function (e) {
      EVT_DIAG.keydown++;
      if (isTextField(e.target)) EVT_DIAG.focusInInput++;
    }, true);
    window.addEventListener('keyup', function () {
      EVT_DIAG.keyup++;
    }, true);
  })();

  var Util = {
    uid: (function () {
      var counter = 0;
      return function () {
        counter += 1;
        return 'e' + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1e6).toString(36);
      };
    })(),

    clamp: function (v, min, max) {
      return v < min ? min : v > max ? max : v;
    },

    round: function (v, d) {
      var f = Math.pow(10, d === undefined ? 0 : d);
      return Math.round(v * f) / f;
    },

    deepClone: function (obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    escapeHtml: function (str) {
      return String(str === undefined || str === null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    debounce: function (fn, delay) {
      var timer = null;
      return function () {
        var args = arguments;
        var self = this;
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          timer = null;
          fn.apply(self, args);
        }, delay);
      };
    },

    /* ---------- Couleurs ---------- */

    hexToRgb: function (hex) {
      var h = String(hex || '').replace('#', '').trim();
      if (h.length === 3) {
        h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      }
      var n = parseInt(h, 16);
      if (isNaN(n)) return { r: 0, g: 0, b: 0 };
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    rgbToHex: function (r, g, b) {
      var c = function (v) {
        v = Util.clamp(Math.round(v), 0, 255);
        var s = v.toString(16);
        return s.length === 1 ? '0' + s : s;
      };
      return '#' + c(r) + c(g) + c(b);
    },

    luminance: function (hex) {
      var c = Util.hexToRgb(hex);
      return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    },

    readableOn: function (hex) {
      return Util.luminance(hex) > 0.55 ? '#1E1E1E' : '#F5F5F5';
    },

    isHexColor: function (str) {
      return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(str || '').trim());
    },

    normalizeHex: function (str) {
      var h = String(str || '').trim();
      if (!Util.isHexColor(h)) return null;
      if (h[0] !== '#') h = '#' + h;
      if (h.length === 4) {
        h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
      }
      return h.toUpperCase();
    },

    /* ---------- Géométrie ---------- */

    rot: function (vx, vy, rad) {
      var c = Math.cos(rad);
      var s = Math.sin(rad);
      return { x: vx * c - vy * s, y: vx * s + vy * c };
    },

    degToRad: function (d) {
      return (d * Math.PI) / 180;
    },

    rectIntersect: function (a, b) {
      return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    },

    rectContainsPoint: function (r, x, y) {
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    },

    unionRects: function (rects) {
      if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
      var minX = Infinity;
      var minY = Infinity;
      var maxX = -Infinity;
      var maxY = -Infinity;
      for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    },

    /* ---------- Événements ---------- */

    /* Branche pointer<kind> ET mouse<kind> sur le même handler, avec
       repli automatique souris si le moteur ne livre pas les Pointer
       Events (voir en-tête de fichier). useCapture optionnel.
       La couverture pointer→souris est PAR NATURE d'événement. */
    bindPointerWithMouse: bindPointerWithMouse,

    /* La cible est-elle un champ de saisie (raccourcis désactivés) ? */
    isTextField: isTextField,

    /* ---------- DOM ---------- */

    el: function (tag, cls, html) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (html !== undefined) node.innerHTML = html;
      return node;
    },

    byId: function (id) {
      return document.getElementById(id);
    },

    setSvg: function (svg, html) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.innerHTML = html;
    },

    /* ---------- Divers ---------- */

    formatBytes: function (bytes) {
      if (bytes < 1024) return bytes + ' o';
      if (bytes < 1024 * 1024) return Util.round(bytes / 1024, 1) + ' Ko';
      return Util.round(bytes / (1024 * 1024), 1) + ' Mo';
    },

    domainOf: function (url) {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch (e) {
        return String(url || '').replace(/^https?:\/\//, '').split('/')[0];
      }
    },

    titleFromUrl: function (url) {
      var d = Util.domainOf(url);
      var path = '';
      try {
        path = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
      } catch (e) {}
      if (path && path.length > 2) {
        path = decodeURIComponent(path).replace(/[-_]+/g, ' ');
        return path.charAt(0).toUpperCase() + path.slice(1, 40);
      }
      return d;
    }
  };

  MB.util = Util;
})();
