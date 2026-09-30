/* =========================================================================
 * utils.js — Aides transverses (géométrie, couleurs, DOM, divers).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  /* Version affichée dans la barre d'état, la boîte « À propos » et le
   * rapport de diagnostic — LA référence pour vérifier que le panneau
   * exécuté est bien la dernière installation. */
  MB.VERSION = '1.1.2';

  /* ---------- Événements adaptatifs (pointer + souris) ----------
   *
   * Contexte : certains moteurs CEP (Illustrator selon version/hôte)
   * livrent mal — voire pas du tout — les Pointer Events, alors que la
   * famille souris (molette, clic, mousemove) fonctionne. Le symptom
   * typique : le zoom molette marche mais aucun drag ne répond.
   *
   * Preuve terrain (diagnostic v1.1.0, Illustrator macOS) : le moteur
   * peut livrer un flux HYBRIDE — pointermove et mousemove OUI, mais
   * pointerdown/pointerup JAMAIS. Un dédoublonnage global (n'importe
   * quel événement pointer couvre n'importe quel événement souris)
   * laissait alors le flux continu de pointermove avaler CHAQUE
   * mousedown/mouseup : plus aucun geste ne démarrait.
   *
   * On branche donc LES DEUX familles sur les mêmes handlers, avec un
   * dédoublonnage APPARIÉ PAR TYPE : un événement souris de type K
   * (down/move/up) est ignoré uniquement si un événement POINTER DU
   * MÊME TYPE K l'a couvert dans les 50 dernières ms (Chromium sain
   * émet la paire pointer puis souris-de-compatibilité de la même
   * impulsion). Ainsi :
   *  - navigateur sain : chaque événement physique est traité une
   *    seule fois (via la famille pointer) ;
   *  - CEP hybride (pointermove sans pointerdown) : le geste démarre
   *    sur mousedown, vit sur pointermove, se termine sur mouseup ;
   *  - CEP souris seule : tout passe par la famille souris ;
   *  - mort du flux pointer en cours de geste : la famille souris
   *    prend le relais après le délai.
   *
   * MB.EVT_DIAG compte les événements bruts reçus de chaque famille —
   * diagnostic direct dans la console DevTools : MB.interact.diag(). */

  var POINTER_COVER_MS = 50;
  var lastPointerTs = { down: -1e9, move: -1e9, up: -1e9 };
  var EVT_DIAG = {
    pointerdown: 0, pointermove: 0, pointerup: 0, pointercancel: 0,
    mousedown: 0, mousemove: 0, mouseup: 0, dragstartBlocked: 0, blur: 0,
    keydown: 0, keyup: 0, focusInInput: 0
  };
  MB.EVT_DIAG = EVT_DIAG;

  function bindPointerWithMouse(target, kind, handler, useCapture) {
    var cap = !!useCapture;
    var paired = Object.prototype.hasOwnProperty.call(lastPointerTs, kind);
    target.addEventListener('pointer' + kind, function (e) {
      EVT_DIAG['pointer' + kind]++;
      if (paired) lastPointerTs[kind] = Date.now();
      handler(e);
    }, cap);
    target.addEventListener('mouse' + kind, function (e) {
      EVT_DIAG['mouse' + kind]++;
      // Ignoré uniquement si l'événement pointer DU MÊME TYPE l'a déjà
      // couvert (appariement par type — voir l'en-tête ci-dessus).
      if (paired && Date.now() - lastPointerTs[kind] < POINTER_COVER_MS) return;
      handler(e);
    }, cap);
  }

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
       Events (voir en-tête de fichier). useCapture optionnel. */
    bindPointerWithMouse: bindPointerWithMouse,

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
