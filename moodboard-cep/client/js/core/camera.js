/* =========================================================================
 * camera.js — Caméra du canvas spatial.
 *
 *   screen = canvas * zoom + pan        (pan = camera.x/y en px écran)
 *   canvas = (screen - pan) / zoom
 *
 * Le zoom est focalisé autour du curseur : le point canvas sous le
 * curseur reste immobile à l'écran. Les coordonnées logiques des objets
 * ne sont JAMAIS modifiées par la caméra.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var MIN_ZOOM = 0.05;
  var MAX_ZOOM = 8;

  var wrap = null;
  var world = null;
  var gridBg = null;

  function cam() {
    return MB.store.s().camera;
  }

  function apply() {
    var c = cam();
    world.style.transform = 'translate(' + c.x + 'px, ' + c.y + 'px) scale(' + c.zoom + ')';
    var s = 24 * c.zoom;
    var showGrid = MB.store.s().ui.grid && c.zoom > 0.18;
    gridBg.style.display = showGrid ? 'block' : 'none';
    gridBg.style.backgroundSize = s + 'px ' + s + 'px';
    gridBg.style.backgroundPosition = c.x + 'px ' + c.y + 'px';
    MB.store.emit('camera');
  }

  function viewport() {
    var r = wrap.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function toCanvas(screenX, screenY) {
    var r = wrap.getBoundingClientRect();
    var c = cam();
    return {
      x: (screenX - r.left - c.x) / c.zoom,
      y: (screenY - r.top - c.y) / c.zoom
    };
  }

  function toScreen(canvasX, canvasY) {
    var r = wrap.getBoundingClientRect();
    var c = cam();
    return {
      x: canvasX * c.zoom + c.x + r.left,
      y: canvasY * c.zoom + c.y + r.top
    };
  }

  function zoomAt(screenX, screenY, factor) {
    var r = wrap.getBoundingClientRect();
    var sx = screenX - r.left;
    var sy = screenY - r.top;
    var c = cam();
    var z2 = U.clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (z2 === c.zoom) return;
    var cx = (sx - c.x) / c.zoom;
    var cy = (sy - c.y) / c.zoom;
    c.zoom = z2;
    c.x = sx - cx * z2;
    c.y = sy - cy * z2;
    apply();
  }

  function setZoom(z, focusScreen) {
    var c = cam();
    var r = wrap.getBoundingClientRect();
    var fx = focusScreen ? focusScreen.x - r.left : r.width / 2;
    var fy = focusScreen ? focusScreen.y - r.top : r.height / 2;
    var z2 = U.clamp(z, MIN_ZOOM, MAX_ZOOM);
    var cx = (fx - c.x) / c.zoom;
    var cy = (fy - c.y) / c.zoom;
    c.zoom = z2;
    c.x = fx - cx * z2;
    c.y = fy - cy * z2;
    apply();
  }

  function panBy(dx, dy) {
    var c = cam();
    c.x += dx;
    c.y += dy;
    apply();
  }

  function fit(bbox, padding) {
    var pad = padding === undefined ? 80 : padding;
    var box = bbox;
    if (!box) {
      var els = MB.store.s().elements.filter(function (e) {
        return !e.hidden;
      });
      if (!els.length) {
        MB.store.setCamera({ x: 0, y: 0, zoom: 1 });
        apply();
        return;
      }
      box = MB.store.bboxOfMany(els);
    }
    var vp = viewport();
    var zw = (vp.w - pad * 2) / Math.max(box.w, 1);
    var zh = (vp.h - pad * 2) / Math.max(box.h, 1);
    var z = U.clamp(Math.min(zw, zh), MIN_ZOOM, 2);
    var c = cam();
    c.zoom = z;
    c.x = vp.w / 2 - (box.x + box.w / 2) * z;
    c.y = vp.h / 2 - (box.y + box.h / 2) * z;
    apply();
  }

  function fitSelection() {
    var sel = MB.store.selected();
    if (!sel.length) return fit(null);
    fit(MB.store.bboxOfMany(sel), 120);
  }

  MB.camera = {
    init: function (wrapEl, worldEl, gridEl) {
      wrap = wrapEl;
      world = worldEl;
      gridBg = gridEl;
      apply();
    },
    apply: apply,
    toCanvas: toCanvas,
    toScreen: toScreen,
    zoomAt: zoomAt,
    setZoom: setZoom,
    panBy: panBy,
    fit: fit,
    fitSelection: fitSelection,
    viewport: viewport,
    MIN_ZOOM: MIN_ZOOM,
    MAX_ZOOM: MAX_ZOOM
  };
})();
