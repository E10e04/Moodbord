/* =========================================================================
 * toolbar.js — Rail d'outils vertical + drag-out vers le canvas (§27).
 * Clic = activer l'outil (création par clic sur le canvas).
 * Glisser depuis le bouton = créer directement au point du drop.
 *
 * v1.9 — OUTIL FORME : le choix (Rectangle / Cercle / Triangle) se fait
 * par double-clic ou appui long sur le bouton d'outil, ou directement
 * au point de dépôt quand l'outil est glissé sur le canvas. Le choix
 * est mémorisé (préférence partagée) et sert aussi au tracé direct.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* Outils — construits AU BOOT (v1.9) : la langue doit être résolue
   * depuis prefs.json AVANT la traduction des libellés. */
  function T(k) {
    return MB.i18n ? MB.i18n.t(k) : k;
  }

  var TOOLS = [];

  function buildTools() {
    return [
      { id: 'select', icon: 'select', key: 'V', tKey: 'tool.select' },
      { id: 'pan', icon: 'pan', key: 'H', tKey: 'tool.pan' },
      { sep: true },
      { id: 'note', icon: 'note', key: 'N', tKey: 'tool.note' },
      { id: 'text', icon: 'text', key: 'T', tKey: 'tool.text' },
      { id: 'checklist', icon: 'checklist', key: 'C', tKey: 'tool.checklist' },
      { id: 'comment', icon: 'comment', key: 'M', tKey: 'tool.comment' },
      { sep: true },
      { id: 'image', icon: 'image', key: 'I', tKey: 'tool.image' },
      { id: 'link', icon: 'link', key: 'L', tKey: 'tool.link' },
      { sep: true },
      { id: 'line', icon: 'line', key: 'P', tKey: 'tool.line' },
      { id: 'shape', icon: 'shape', key: 'R', tKey: 'tool.shape' },
      { id: 'sketch', icon: 'sketch', key: 'B', tKey: 'tool.sketch' },
      { sep: true },
      { id: 'section', icon: 'section', key: 'S', tKey: 'tool.section' },
      { id: 'column', icon: 'column', tKey: 'tool.column' },
      { id: 'table', icon: 'table', tKey: 'tool.table' },
      { id: 'board', icon: 'board', key: 'E', tKey: 'tool.board' },
      { sep: true },
      { id: 'color', icon: 'color', key: 'K', tKey: 'tool.color' },
      { id: 'palette', icon: 'palette', key: 'A', tKey: 'tool.palette' },
      { id: 'typography', icon: 'typography', key: 'Y', tKey: 'tool.typography' },
      { sep: true },
      { id: 'import', icon: 'import', tKey: 'tool.import' }
    ];
  }

  function toolLabel(t) {
    return T(t.tKey + '.label');
  }

  function toolHint(t) {
    return T(t.tKey + '.hint');
  }

  /* ------------------------------------------- v1.9 : formes au choix */

  var SHAPE_CHOICES = [
    { id: 'rect', icon: 'square', key: 'shape.rect' },
    { id: 'ellipse', icon: 'circle', key: 'shape.ellipse' },
    { id: 'triangle', icon: 'triangle', key: 'shape.triangle' }
  ];

  function shapeLabelOf(s) {
    return T(s.key);
  }

  /* Le triangle est un polygone régulier dont le nombre de branches se
   * règle ensuite dans le panneau Projet (3 = triangle, 4 = losange…). */
  function currentShape() {
    var p = MB.storage && MB.storage.prefs ? MB.storage.prefs() : null;
    var s = p && p.shapeTool;
    for (var i = 0; i < SHAPE_CHOICES.length; i++) {
      if (SHAPE_CHOICES[i].id === s) return s;
    }
    return 'rect';
  }

  function setCurrentShape(id) {
    for (var i = 0; i < SHAPE_CHOICES.length; i++) {
      if (SHAPE_CHOICES[i].id === id) {
        if (MB.storage && MB.storage.setPref) MB.storage.setPref('shapeTool', id);
        return;
      }
    }
  }

  /* Ancre invisible réutilisée pour ouvrir le sélecteur au point de
   * dépôt sur le canvas (le popover se positionne sur un élément). */
  function pickAnchorAt(sx, sy) {
    var a = document.getElementById('shape-pick-anchor');
    if (!a) {
      a = U.el('div');
      a.id = 'shape-pick-anchor';
      a.setAttribute('aria-hidden', 'true');
      document.body.appendChild(a);
    }
    a.style.cssText = 'position:fixed;left:' + sx + 'px;top:' + sy + 'px;width:0;height:0;';
    return a;
  }

  function shapePicker(anchor, onPick) {
    var html = '<div class="shape-grid">';
    SHAPE_CHOICES.forEach(function (s) {
      html +=
        '<button type="button" class="shape-tile" data-shape="' + s.id + '" ' +
        'title="' + shapeLabelOf(s) + '" aria-label="' + shapeLabelOf(s) + '">' +
        MB.icons.get(s.icon, 26) +
        '<span>' + shapeLabelOf(s) + '</span>' +
        '</button>';
    });
    html += '</div>';
    MB.ui.popover(anchor, html, {
      bind: function (p) {
        p.querySelectorAll('[data-shape]').forEach(function (b) {
          b.addEventListener('click', function () {
            MB.ui.closePopover();
            setCurrentShape(b.dataset.shape);
            refresh();
            onPick(b.dataset.shape);
          });
        });
      }
    });
  }

  /* Extra de création pour l'outil Forme (utilisé par le tracé direct
   * sur le canvas — interactions.js). */
  function shapeExtra(extra) {
    var out = extra || {};
    out.shape = currentShape();
    return out;
  }

  function init() {
    TOOLS.length = 0;
    buildTools().forEach(function (x) {
      TOOLS.push(x);
    });
    var rail = document.getElementById('toolrail');
    var frag = document.createDocumentFragment();

    TOOLS.forEach(function (t) {
      if (t.sep) {
        frag.appendChild(U.el('div', 'tool-sep'));
        return;
      }
      var btn = U.el('button', 'tool-btn');
      btn.dataset.tool = t.id;
      btn.type = 'button';
      btn.setAttribute('aria-label', toolLabel(t));
      btn.setAttribute('data-tip', toolLabel(t) + (t.key ? ' (' + t.key + ')' : ''));
      btn.innerHTML = MB.icons.get(t.icon, 19);
      btn.title = toolLabel(t) + (t.key ? ' (' + t.key + ')' : '');
      bindTool(btn, t);
      frag.appendChild(btn);
    });

    rail.appendChild(frag);

    MB.store.on('tool', function (tool) {
      refresh();
    });
    MB.store.on('ui', function (patch) {
      if (patch && patch.activeGroupId !== undefined) refresh();
    });
    refresh();

    // raccourcis clavier outils
    window.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var keyMap = {};
      TOOLS.forEach(function (tool) {
        if (tool.key) keyMap[tool.key.toLowerCase()] = tool.id;
      });
      var id = keyMap[e.key.toLowerCase()];
      if (id) {
        MB.store.setTool(id);
        e.preventDefault();
      }
    });
  }

  function bindTool(btn, t) {
    /* Couche adaptative pointer + souris (cf. utils.js) : le drag-out
     * doit démarrer même dans les moteurs CEP qui ne livrent PAS
     * pointerdown (flux hybride documenté par le diagnostic v1.1.0 :
     * pointermove sans pointerdown). Un listener « pointerdown » seul
     * rendait le glisser-déposer des outils impossible dans Illustrator. */
    var pressTimer = null;
    var pressStart = null;

    function cancelPress() {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressStart = null;
    }

    U.bindPointerWithMouse(btn, 'down', function (e) {
      if (e.button !== 0) return;

      /* v1.9 — OUTIL FORME : appui long (~450 ms sans bouger) sur le
       * bouton → sélecteur Rectangle / Cercle / Triangle. */
      if (t.id === 'shape') {
        pressStart = { x: e.clientX, y: e.clientY };
        cancelPress();
        pressTimer = setTimeout(function () {
          pressTimer = null;
          /* L'appui s'est prolongé SANS drag : on ouvre le sélecteur et
           * le ghost éventuel est annulé (il n'a pas démarré : seuil
           * de 5 px non atteint, sinon ce minuteur aurait sauté). */
          MB.ui.ghost.cancel('sélecteur de forme', true);
          shapePicker(btn, function (shape) {
            MB.store.setTool('shape');
          });
        }, 450);
      }

      // drag-out : ghost + drop sur le canvas
      MB.ui.ghost.start(
        {
          sx: e.clientX,
          sy: e.clientY,
          label: 'outil:' + t.id,
          html: '<div class="ghost-card">' + MB.icons.get(t.icon, 18) + '<span>' + U.escapeHtml(toolLabel(t)) + '</span></div>'
        },
        function (point) {
          /* v1.9 — FORME : au dépôt, le sélecteur s'ouvre AU POINT DE
           * DÉPÔT : rectangle, cercle ou triangle, créé sur place. */
          if (t.id === 'shape') {
            var s = MB.camera.toScreen(point.x, point.y);
            var anchor = pickAnchorAt(Math.max(10, s.x - 12), Math.max(10, s.y - 12));
            shapePicker(anchor, function (shape) {
              MB.interact.createAt('shape', point, { shape: shape });
            });
            return;
          }
          MB.interact.createAt(t.id, point);
        }
      );
    });

    /* L'appui long se limite au bouton pressé : tout mouvement réel
     * (le drag-out part) l'annule. */
    U.bindPointerWithMouse(btn, 'move', function (e) {
      if (!pressTimer) return;
      if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 6) cancelPress();
    });
    U.bindPointerWithMouse(btn, 'up', cancelPress);
    U.bindPointerWithMouse(btn, 'cancel', cancelPress);

    // clic simple (pas de drag) : active l'outil
    btn.addEventListener('click', function () {
      MB.store.setTool(t.id);
    });

    /* v1.8 — double-clic sur l'outil Importer : ouvre DIRECTEMENT
     * l'explorateur / le Finder (sans passer par le canvas). */
    if (t.id === 'import') {
      btn.addEventListener('dblclick', function (e) {
        e.preventDefault();
        MB.interact.openImportPicker(null);
        MB.store.setTool('select');
      });
    }

    /* v1.9 — double-clic sur l'outil Forme : sélecteur de forme
     * (Rectangle / Cercle / Triangle), mémorisé pour les tracés. */
    if (t.id === 'shape') {
      btn.addEventListener('dblclick', function (e) {
        e.preventDefault();
        cancelPress();
        shapePicker(btn, function () {
          MB.store.setTool('shape');
        });
      });
    }
  }

  function refresh() {
    var st = MB.store.s();
    var rail = document.getElementById('toolrail');
    rail.classList.toggle('is-group-mode', !!st.ui.activeGroupId);
    rail.querySelectorAll('.tool-btn').forEach(function (b) {
      var active = b.dataset.tool === st.tool;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var hint = document.getElementById('sb-hint');
    if (hint) {
      var tool = null;
      TOOLS.forEach(function (t) {
        if (t.id === st.tool) tool = t;
      });
      hint.textContent = tool ? toolLabel(tool) + ' — ' + toolHint(tool) : '';
      /* v1.9 — l'outil Forme rappelle la forme active (celle du tracé). */
      if (st.tool === 'shape' && tool) {
        var cur = null;
        SHAPE_CHOICES.forEach(function (s) {
          if (s.id === currentShape()) cur = s;
        });
        hint.textContent = MB.i18n.t('tool.shape.current', {
          shape: cur ? shapeLabelOf(cur) : currentShape()
        });
      }
      if (st.ui.activeGroupId) {
        hint.textContent =
          MB.i18n.lang() === 'en' ? 'Inside the group — Esc to leave' : 'Dans le groupe — Échap pour sortir';
      }
    }
  }

  MB.ui = MB.ui || {};
  MB.ui.toolbar = {
    init: init,
    TOOLS: TOOLS,
    SHAPE_CHOICES: SHAPE_CHOICES,
    currentShape: currentShape,
    setCurrentShape: setCurrentShape,
    shapeExtra: shapeExtra,
    shapePicker: shapePicker
  };
})();
