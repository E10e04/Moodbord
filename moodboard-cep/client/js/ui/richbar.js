/* =========================================================================
 * richbar.js — Barre de mise en forme flottante pendant l'édition riche
 * (notes et textes, v1.8).
 *
 * Apparaît au-dessus de l'élément en cours d'édition : gras, italique,
 * souligné, barré, surlignage, listes à puces / numérotées, police de la
 * SÉLECTION et effacement de la mise en forme. Les commandes passent par
 * MB.rich.exec (la sélection est restaurée même après un clic dans la
 * barre — les boutons ne prennent jamais le focus).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var bar = null;
  var currentId = null;

  var HIGHLIGHTS = [
    { hex: '#FFE066', name: 'Jaune' },
    { hex: '#FFD29D', name: 'Pêche' },
    { hex: '#B8E986', name: 'Menthe' },
    { hex: '#9DD6E8', name: 'Ciel' },
    { hex: '#D9B8FF', name: 'Lilas' },
    { hex: '#F3B8C4', name: 'Rose' }
  ];

  function editingEl() {
    var id = MB.store.s().ui.editingId;
    if (!id) return null;
    var el = MB.store.el(id);
    if (!el) return null;
    /* v1.11 — la barre s'applique AUSSI aux TITRES des colonnes
     * (champs riches) : couleur et mise en forme de l'en-tête
     * (demande utilisateur).
     * v1.12 — l'outil Section est retiré : colonnes seules. */
    if (el.type === 'note' || el.type === 'text') return el;
    if (el.type === 'column') return el;
    return null;
  }

  /* Champ en cours d'édition (le nœud .is-editing porte data-field) :
   * 'text' pour les corps, 'title' pour les en-têtes. */
  function editingField(el) {
    var view = MB.board.viewOf(el.id);
    var node = view ? view.node.querySelector('[data-field].is-editing') : null;
    return node ? node.getAttribute('data-field') : null;
  }

  /* v1.11 — couleurs du TEXTE (bouton « A » de la barre) : palette
   * complète de l'application + saisie hex. */
  var TEXT_COLORS = [
    '#F5F5F5', '#A8A8A8', '#3A3A3A', '#1E1E1E', '#FFFFFF',
    '#4C8DFF', '#22303B', '#2F4A41', '#7A522E', '#5C2E2E',
    '#F2A93B', '#D96C3F', '#A63D2F', '#9C4F7C', '#5F7161'
  ];

  function toggleTextColor(anchor) {
    var html =
      '<div class="hl-grid">' +
      TEXT_COLORS.map(function (hex) {
        return '<button class="swatch" data-fc="' + hex + '" style="background:' + hex + '" title="' + hex + '" aria-label="Couleur du texte ' + hex + '"></button>';
      }).join('') +
      '</div>' +
      '<div class="pop-row"><input class="input input--hex" id="fc-hex" placeholder="#RRGGBB" aria-label="Code hexadécimal"></div>';
    MB.ui.popover(anchor, html, {
      bind: function (p) {
        p.querySelectorAll('[data-fc]').forEach(function (s) {
          s.addEventListener('pointerdown', function (e) {
            e.preventDefault();
          });
          s.addEventListener('mousedown', function (e) {
            e.preventDefault();
          });
          s.addEventListener('click', function () {
            MB.rich.exec('foreColor', s.dataset.fc);
            MB.ui.closePopover();
            refreshStates();
          });
        });
        var hex = p.querySelector('#fc-hex');
        if (hex) {
          hex.addEventListener('change', function () {
            var v = U.normalizeHex(hex.value);
            if (v) {
              MB.rich.exec('foreColor', v);
              MB.ui.closePopover();
            }
          });
        }
      }
    });
  }

  function build() {
    if (bar) return bar;
    bar = U.el('div', 'richbar');
    bar.id = 'richbar';
    bar.hidden = true;
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Mise en forme du texte');

    /* Aucun bouton de la barre ne doit voler le focus de l'éditeur :
     * pointerdown neutralisé, l'action part au clic. */
    bar.addEventListener('pointerdown', function (e) {
      if (e.button === 0) e.preventDefault();
    });
    bar.addEventListener('mousedown', function (e) {
      if (e.button === 0) e.preventDefault();
    });

    function btn(icon, label, onClick, stateCmd) {
      var b = U.el('button', 'ctx-btn rich-btn');
      b.type = 'button';
      b.innerHTML = MB.icons.get(icon, 15);
      b.setAttribute('data-tip', label);
      b.setAttribute('aria-label', label);
      if (stateCmd) b.dataset.state = stateCmd;
      b.addEventListener('click', function () {
        onClick();
        refreshStates();
      });
      return b;
    }

    var g1 = U.el('div', 'ctx-group');
    g1.appendChild(btn('bold', 'Gras (⌘B)', function () {
      MB.rich.exec('bold');
    }, 'bold'));
    g1.appendChild(btn('italic', 'Italique (⌘I)', function () {
      MB.rich.exec('italic');
    }, 'italic'));
    g1.appendChild(btn('underline', 'Souligné (⌘U)', function () {
      MB.rich.exec('underline');
    }, 'underline'));
    g1.appendChild(btn('strike', 'Barré', function () {
      MB.rich.exec('strikeThrough');
    }, 'strikeThrough'));
    bar.appendChild(g1);

    bar.appendChild(U.el('div', 'ctx-sep'));

    var g2 = U.el('div', 'ctx-group');
    var hlBtn = U.el('button', 'ctx-btn rich-btn rich-btn--hl');
    hlBtn.type = 'button';
    hlBtn.innerHTML = MB.icons.get('highlighter', 15);
    hlBtn.setAttribute('data-tip', 'Surligner la sélection');
    hlBtn.setAttribute('aria-label', 'Surligner la sélection');
    hlBtn.addEventListener('click', function () {
      toggleHighlight(hlBtn);
    });
    g2.appendChild(hlBtn);
    /* v1.11 — COULEUR DU TEXTE : le même popover que le surlignage,
     * mais pour l'encre (foreColor). Visible pour les corps ET les
     * titres d'en-tête. */
    var fcBtn = U.el('button', 'ctx-btn rich-btn rich-btn--fc');
    fcBtn.type = 'button';
    fcBtn.innerHTML = MB.icons.get('textColor', 15);
    fcBtn.setAttribute('data-tip', 'Couleur du texte');
    fcBtn.setAttribute('aria-label', 'Couleur du texte');
    fcBtn.addEventListener('click', function () {
      toggleTextColor(fcBtn);
    });
    g2.appendChild(fcBtn);
    var listBtn = btn('list', 'Liste à puces', function () {
      MB.rich.exec('insertUnorderedList');
    }, 'insertUnorderedList');
    listBtn.classList.add('rich-btn--list');
    g2.appendChild(listBtn);
    var listBtn2 = btn('listOrdered', 'Liste numérotée', function () {
      MB.rich.exec('insertOrderedList');
    }, 'insertOrderedList');
    listBtn2.classList.add('rich-btn--list');
    g2.appendChild(listBtn2);
    bar.appendChild(g2);

    bar.appendChild(U.el('div', 'ctx-sep'));

    var g3 = U.el('div', 'ctx-group');
    var fBtn = U.el('button', 'ctx-btn ctx-font-btn rich-btn');
    fBtn.type = 'button';
    fBtn.innerHTML = '<span>Aa</span>' + MB.icons.get('chevronDown', 12);
    fBtn.setAttribute('data-tip', 'Police de la sélection');
    fBtn.setAttribute('aria-label', 'Police de la sélection');
    fBtn.addEventListener('click', function () {
      var cur = '';
      try {
        cur = document.queryCommandValue('fontName') || '';
      } catch (e) {
        cur = '';
      }
      cur = String(cur).replace(/^["']|["']$/g, '');
      var el = editingEl();
      MB.ui.controls.fontPopover(fBtn, function () {
        return cur || (el && el.data.fontFamily) || 'Georgia';
      }, function (name) {
        MB.rich.exec('fontName', name);
        fBtn.querySelector('span').textContent = name.length > 10 ? name.slice(0, 9) + '…' : name;
      });
    });
    g3.appendChild(fBtn);
    /* v1.18 — GRAISSE de la sélection : posée à côté du sélecteur de
     * police de la barre de mise en forme. Applique un
     * <span style="font-weight:…"> via MB.rich.applyWeight. */
    var wBtn = U.el('button', 'ctx-btn ctx-font-btn ctx-weight-btn rich-btn');
    wBtn.type = 'button';
    wBtn.innerHTML = '<span class="font-btn-label">Graisse</span>' + MB.icons.get('chevronDown', 12);
    wBtn.setAttribute('data-tip', 'Graisse de la sélection');
    wBtn.setAttribute('aria-label', 'Graisse de la sélection');
    wBtn.addEventListener('click', function () {
      var cur = '';
      try {
        cur = document.queryCommandValue('fontName') || '';
      } catch (e) {
        cur = '';
      }
      cur = String(cur).replace(/^["']|["']$/g, '');
      var el = editingEl();
      MB.ui.controls.weightPopover(wBtn, function () {
        return cur || (el && el.data.fontFamily) || 'Georgia';
      }, function () {
        return 400;
      }, function (w) {
        MB.rich.applyWeight(w);
      });
    });
    g3.appendChild(wBtn);
    g3.appendChild(btn('eraser', 'Effacer la mise en forme', function () {
      MB.rich.exec('removeFormat');
    }));
    bar.appendChild(g3);

    document.getElementById('board-wrap').appendChild(bar);
    return bar;
  }

  function toggleHighlight(anchor) {
    var html =
      '<div class="hl-grid">' +
      HIGHLIGHTS.map(function (h) {
        return '<button class="swatch" data-hl="' + h.hex + '" style="background:' + h.hex + '" title="' + h.name + '" aria-label="Surligner ' + h.name + '"></button>';
      }).join('') +
      '</div>';
    MB.ui.popover(anchor, html, {
      bind: function (p) {
        p.querySelectorAll('[data-hl]').forEach(function (s) {
          s.addEventListener('pointerdown', function (e) {
            e.preventDefault();
          });
          s.addEventListener('mousedown', function (e) {
            e.preventDefault();
          });
          s.addEventListener('click', function () {
            var ok = MB.rich.exec('hiliteColor', s.dataset.hl);
            if (!ok) MB.rich.exec('backColor', s.dataset.hl);
            MB.ui.closePopover();
            refreshStates();
          });
        });
      }
    });
  }

  /* États actifs (boutons enfoncés) selon la sélection courante. */
  function refreshStates() {
    if (!bar) return;
    bar.querySelectorAll('.rich-btn[data-state]').forEach(function (b) {
      b.classList.toggle('is-active', MB.rich.queryState(b.dataset.state));
    });
  }

  function position() {
    var el = editingEl();
    if (!el || !bar) return;
    var view = MB.board.viewOf(el.id);
    if (!view) return;
    var c = MB.store.s().camera;
    var wrap = document.getElementById('board-wrap');
    var r = wrap.getBoundingClientRect();
    var x = el.x * c.zoom + c.x + (el.w * c.zoom) / 2;
    var y = el.y * c.zoom + c.y;
    var bw = bar.offsetWidth;
    bar.style.left = U.clamp(x - bw / 2, 8, r.width - bw - 8) + 'px';
    var top = y - 46;
    if (top < 46) top = y + el.h * c.zoom + 10;
    bar.style.top = Math.max(8, top) + 'px';
  }

  function refresh() {
    build();
    var el = editingEl();
    if (!el || (MB.ui.home && MB.ui.home.visible())) {
      bar.hidden = true;
      currentId = null;
      return;
    }
    /* v1.11 — MODE TITRE : l'édition d'un en-tête (colonne/section)
     * cache les boutons de LISTES (une liste dans un titre n'a pas de
     * sens) — gras, italique, souligné, surlignage, couleur et police
     * restent. */
    var isTitle = editingField(el) === 'title';
    bar.classList.toggle('richbar--title', isTitle);
    if (currentId !== el.id) {
      currentId = el.id;
      refreshStates();
    }
    bar.hidden = false;
    position();
  }

  function init() {
    MB.store.on('ui', function (patch) {
      if (patch && patch.editingId !== undefined) refresh();
    });
    MB.store.on('camera', function () {
      if (bar && !bar.hidden) position();
    });
    MB.store.on('element', function () {
      if (bar && !bar.hidden) position();
    });
    document.addEventListener('selectionchange', function () {
      if (bar && !bar.hidden) {
        /* léger différé : l'état est stable au repos de la sélection */
        setTimeout(refreshStates, 0);
      }
    });
    refresh();
  }

  MB.ui = MB.ui || {};
  MB.ui.richbar = { init: init, refresh: refresh };
})();
