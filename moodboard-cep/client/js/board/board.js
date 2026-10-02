/* =========================================================================
 * board.js — Contrôleur du canvas : monde DOM transformé par la caméra,
 * réconciliation des vues, calques d'overlay (sélection, guides, marquee).
 *
 * Les éléments vivent dans #world avec leurs coordonnées canvas (px logiques).
 * L'overlay de sélection vit en espace ÉCRAN (taille constante au zoom).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var world;
  var wrap;
  var board;
  var gridBg;
  var overlay;
  var guides;
  var marqueeEl;

  var views = {}; // id -> view (créées par elementView.js)

  /* Ordre de peinture : racines dans l'ordre du tableau, chaque racine
     suivie de ses descendants (les enfants au-dessus de leur parent). */
  function renderOrder() {
    var st = MB.store.s();
    var byParent = {};
    var roots = [];
    for (var i = 0; i < st.elements.length; i++) {
      var e = st.elements[i];
      if (e.parentId && st.elements.some(function (x) {
        return x.id === e.parentId;
      })) {
        (byParent[e.parentId] = byParent[e.parentId] || []).push(e);
      } else {
        roots.push(e);
      }
    }
    var out = [];
    function walk(list) {
      for (var i = 0; i < list.length; i++) {
        out.push(list[i]);
        var kids = byParent[list[i].id];
        if (kids) walk(kids);
      }
    }
    walk(roots);
    // éléments orphelins (parent disparu) traités comme racines plus haut
    return out;
  }

  function reconcile() {
    var st = MB.store.s();
    var alive = {};
    for (var i = 0; i < st.elements.length; i++) alive[st.elements[i].id] = true;

    Object.keys(views).forEach(function (id) {
      if (!alive[id]) {
        views[id].destroy();
        delete views[id];
      }
    });

    var order = renderOrder();
    var frag = document.createDocumentFragment();
    for (var j = 0; j < order.length; j++) {
      var e = order[j];
      var v = views[e.id];
      if (!v) {
        v = MB.elementView.create(e);
        views[e.id] = v;
      } else if (v.el !== e) {
        // L'objet élément a été REMPLACÉ sous le même id (loadDocument —
        // ex. démo rechargée après une autosave : mêmes ids « demo-* »).
        // La vue doit suivre le nouveau modèle, pas conserver l'ancien
        // rendu (sinon le DOM montre d'anciennes positions tandis que le
        // modèle, la sélection et les drags vivent aux nouvelles).
        v.rev = -1; // force le re-rendu du contenu
        v.update(e);
      } else {
        v.update(e);
      }
      frag.appendChild(v.node);
    }
    world.appendChild(frag);

    updateEmptyHint();
    refreshOverlay();
  }

  function updateViews(ids) {
    for (var i = 0; i < ids.length; i++) {
      var v = views[ids[i]];
      if (!v) continue;
      var e = MB.store.el(ids[i]);
      if (!e) continue;
      v.update(e);
    }
    refreshOverlay();
  }

  function updateEmptyHint() {
    var hint = document.getElementById('empty-hint');
    if (!hint) return;
    var st = MB.store.s();
    hint.hidden = st.elements.length !== 0;
  }

  /* ------------------------------------------------- overlay sélection */

  function screenRectOf(el) {
    var c = MB.store.s().camera;
    var r = wrap.getBoundingClientRect();
    return {
      x: el.x * c.zoom + c.x,
      y: el.y * c.zoom + c.y,
      w: el.w * c.zoom,
      h: el.h * c.zoom,
      rot: el.rotation || 0
    };
  }

  function refreshOverlay() {
    var st = MB.store.s();
    var sel = st.selection.ids;
    overlay.innerHTML = '';

    if (!sel.length) {
      refreshContextbar();
      return;
    }

    var selectedEls = MB.store.els(sel);

    // silhouettes individuelles
    selectedEls.forEach(function (e) {
      if (e.type === 'group') return;
      var s = screenRectOf(e);
      var box = U.el('div', 'sel-box');
      box.style.left = s.x + 'px';
      box.style.top = s.y + 'px';
      box.style.width = s.w + 'px';
      box.style.height = s.h + 'px';
      if (s.rot) {
        box.style.transform = 'rotate(' + s.rot + 'deg)';
      }
      overlay.appendChild(box);
    });

    // boîte principale = union des boîtes englobantes
    var bboxes = selectedEls.map(MB.store.bboxOf);
    var u = U.unionRects(bboxes);
    var c = MB.store.s().camera;
    var main = U.el('div', 'sel-union');
    main.style.left = (u.x * c.zoom + c.x) + 'px';
    main.style.top = (u.y * c.zoom + c.y) + 'px';
    main.style.width = (u.w * c.zoom) + 'px';
    main.style.height = (u.h * c.zoom) + 'px';

    var single = selectedEls.length === 1 ? selectedEls[0] : null;
    var movable = !single || !single.locked;

    if (single && single.type === 'line') {
      var d = single.data;
      var p1 = {
        x: d.x1 * c.zoom + c.x,
        y: d.y1 * c.zoom + c.y
      };
      var p2 = {
        x: d.x2 * c.zoom + c.x,
        y: d.y2 * c.zoom + c.y
      };
      [p1, p2].forEach(function (p, i) {
        var h = U.el('div', 'endpoint' + (single.locked ? ' is-disabled' : ''));
        h.dataset.end = i === 0 ? 'start' : 'end';
        h.dataset.id = single.id;
        h.style.left = p.x + 'px';
        h.style.top = p.y + 'px';
        overlay.appendChild(h);
      });
    } else if (movable && !st.ui.cropId) {
      var handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
      for (var i = 0; i < handles.length; i++) {
        var h2 = U.el('div', 'handle');
        h2.dataset.h = handles[i];
        h2.dataset.id = single ? single.id : '';
        main.appendChild(h2);
      }
      var rot = U.el('div', 'handle handle--rot');
      rot.dataset.h = 'rot';
      rot.dataset.id = single ? single.id : '';
      main.appendChild(rot);
    } else if (single && single.locked) {
      var badge = U.el('div', 'lock-badge', MB.icons.get('lock', 13));
      main.appendChild(badge);
    }

    overlay.appendChild(main);
    refreshContextbar();
  }

  function refreshContextbar() {
    if (MB.ui && MB.ui.contextbar) MB.ui.contextbar.refresh();
  }

  /* --------------------------------------------------------- guides */

  function clearGuides() {
    guides.innerHTML = '';
  }

  function drawGuides(lines) {
    clearGuides();
    if (!lines || !lines.length) return;
    var c = MB.store.s().camera;
    var svg = '';
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var x1 = ln.x1 * c.zoom + c.x;
      var y1 = ln.y1 * c.zoom + c.y;
      var x2 = ln.x2 * c.zoom + c.x;
      var y2 = ln.y2 * c.zoom + c.y;
      svg +=
        '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' +
        'stroke="#4C8DFF" stroke-width="1" stroke-dasharray="4 3" />';
      svg +=
        '<circle cx="' + x1 + '" cy="' + y1 + '" r="2.5" fill="#4C8DFF" />';
    }
    guides.innerHTML = svg;
  }

  /* --------------------------------------------------------- marquee */

  function showMarquee(rectScreen) {
    marqueeEl.hidden = false;
    marqueeEl.style.left = rectScreen.x + 'px';
    marqueeEl.style.top = rectScreen.y + 'px';
    marqueeEl.style.width = Math.max(rectScreen.w, 1) + 'px';
    marqueeEl.style.height = Math.max(rectScreen.h, 1) + 'px';
  }

  function hideMarquee() {
    marqueeEl.hidden = true;
  }

  /* --------------------------------------------------------- divers */

  function viewOf(id) {
    return views[id];
  }

  function hitElement(clientX, clientY) {
    var node = document.elementFromPoint(clientX, clientY);
    if (!node) return null;
    var host = node.closest ? node.closest('.mb-el') : null;
    if (!host) return null;
    return MB.store.el(host.dataset.id) || null;
  }

  MB.board = {
    init: function () {
      world = document.getElementById('world');
      wrap = document.getElementById('board-wrap');
      board = document.getElementById('board');
      gridBg = document.getElementById('grid-bg');
      overlay = document.getElementById('overlay');
      guides = document.getElementById('guides');
      marqueeEl = document.getElementById('marquee');

      MB.camera.init(wrap, world, gridBg);

      MB.store.on('elements', reconcile);
      MB.store.on('element', function (payload) {
        updateViews(payload.ids);
      });
      MB.store.on('selection', refreshOverlay);
      MB.store.on('camera', refreshOverlay);
      MB.store.on('ui', function (patch) {
        if (patch && (patch.snap !== undefined || patch.grid !== undefined)) refreshOverlay();
      });
      window.addEventListener('resize', function () {
        refreshOverlay();
      });
    },
    reconcile: reconcile,
    updateViews: updateViews,
    renderContent: function (id) {
      var v = views[id];
      if (v) v.renderContent(MB.store.el(id));
    },
    refreshOverlay: refreshOverlay,
    clearGuides: clearGuides,
    drawGuides: drawGuides,
    showMarquee: showMarquee,
    hideMarquee: hideMarquee,
    viewOf: viewOf,
    hitElement: hitElement,
    worldEl: function () {
      return world;
    },
    wrapEl: function () {
      return wrap;
    }
  };
})();
