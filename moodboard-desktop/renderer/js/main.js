/* =========================================================================
 * main.js — Bootstrap de l'application, raccourcis clavier, actions
 * globales (MB.app) et premier lancement (démo).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  function boot() {
    if (MB.desktop) MB.desktop.init(); // classe body + titre + menus natifs (inerte hors application)
    MB.storage.init();
    if (MB.diaglog) MB.diaglog.init(); // journal fichier + capture d'erreurs
    MB.cep.init();
    MB.board.init();
    MB.interact.init();
    MB.ui.toolbar.init();
    MB.ui.topbar.init();
    MB.ui.library.init();
    MB.ui.inspector.init();
    MB.ui.contextbar.init();
    MB.ui.contextmenu.init();
    bindKeyboard();
    bindPanels();
    bindStatusbar();
    firstRun();
    statusCounts();
  }

  /* ------------------------------------------------ premier lancement */

  function firstRun() {
    var loaded = false;
    if (MB.storage.hasAutosave()) {
      var res = MB.storage.loadAutosave();
      if (res && res.doc) {
        MB.storage.openFile(res.doc, null);
        loaded = true;
      }
    }
    if (!loaded && MB.storage.firstRunFlag()) {
      MB.storage.setFirstRunFlag();
      loadDemo(false);
    } else if (!loaded) {
      MB.store.loadDocument({ name: 'Sans titre', elements: [] });
    }
  }

  function loadDemo(confirmFirst) {
    var go = function () {
      var doc = MB.demo.build();
      MB.store.loadDocument(doc);
      MB.camera.fit(null, 90);
      MB.storage.markSaved();
      MB.ui.toast('Tableau de démonstration chargé', 'success');
    };
    if (confirmFirst) {
      MB.ui.confirmDialog({
        title: 'Charger la démonstration ?',
        message: 'Le tableau courant sera remplacé (pensez à enregistrer).',
        confirmLabel: 'Charger',
        danger: true
      }).then(function (ok) {
        if (ok) go();
      });
    } else {
      go();
    }
  }

  function newBoard() {
    MB.ui.confirmDialog({
      title: 'Nouveau moodboard',
      message: 'Effacer le tableau courant ? Les modifications non enregistrées seront perdues.',
      confirmLabel: 'Nouveau tableau',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      MB.store.loadDocument({ name: 'Sans titre', elements: [] });
      MB.camera.fit(null);
      MB.storage.markSaved();
      try {
        localStorage.removeItem('mb.autosave.v1');
      } catch (e) {
        /* CEP : l'autosave est réécrit à la prochaine modification */
      }
      MB.ui.toast('Nouveau tableau', 'success');
    });
  }

  /* ------------------------------------------------------ actions */

  var App = {
    newBoard: newBoard,
    loadDemo: loadDemo,

    togglePanel: function (which) {
      var st = MB.store.s();
      if (which === 'library') {
        MB.store.setUI({ libraryOpen: !st.ui.libraryOpen });
      } else {
        MB.store.setUI({ inspectorOpen: !st.ui.inspectorOpen });
      }
    },

    toggleLock: function () {
      var sel = MB.store.selected();
      if (!sel.length) return;
      var lockTo = !sel.every(function (e) {
        return e.locked;
      });
      MB.store.mutate(lockTo ? 'Verrouiller' : 'Déverrouiller', function () {
        sel.forEach(function (el) {
          MB.store.updateElement(el.id, { locked: lockTo }, { transaction: true });
        });
      });
    },

    toggleHide: function (hide) {
      var sel = MB.store.selected();
      if (!sel.length) return;
      MB.store.mutate('Masquer', function () {
        sel.forEach(function (el) {
          MB.store.updateElement(el.id, { hidden: hide }, { transaction: true });
        });
      });
      MB.store.clearSelection();
    },

    revealAll: function () {
      var st = MB.store.s();
      var any = st.elements.some(function (e) {
        return e.hidden;
      });
      if (!any) {
        MB.ui.toast('Aucun élément masqué.', 'info');
        return;
      }
      MB.store.mutate('Révéler tout', function () {
        st.elements.forEach(function (el) {
          if (el.hidden) MB.store.updateElement(el.id, { hidden: false }, { transaction: true });
        });
      });
    },

    reorderSelection: function (mode) {
      var sel = MB.store.selectedIds();
      if (!sel.length) return;
      sel.forEach(function (id) {
        MB.store.reorder(id, mode);
      });
      MB.store.emit('elements');
      MB.store.emit('selection');
    },

    /* Disposition automatique d'un lot d'images. */
    autoArrange: function (images, mode) {
      if (images.length < 2) return;
      var label = 'Disposition ' + mode;
      MB.store.mutate(label, function () {
        var bbox = MB.store.bboxOfMany(images);
        var gap = 16;
        if (mode === 'grid') {
          var cols = Math.ceil(Math.sqrt(images.length));
          var rows = Math.ceil(images.length / cols);
          var cellW = (bbox.w - gap * (cols - 1)) / cols;
          var cellH = (bbox.h - gap * (rows - 1)) / rows;
          images.forEach(function (img, i) {
            var r = Math.floor(i / cols);
            var c = i % cols;
            var ratio = (img.data.naturalH || img.h) / (img.data.naturalW || img.w);
            var w = cellW;
            var h = w * ratio;
            if (h > cellH) {
              h = cellH;
              w = h / ratio;
            }
            img.w = Math.round(w);
            img.h = Math.round(h);
            img.x = Math.round(bbox.x + c * (cellW + gap) + (cellW - w) / 2);
            img.y = Math.round(bbox.y + r * (cellH + gap) + (cellH - h) / 2);
          });
        } else if (mode === 'masonry') {
          var ncols = Math.max(2, Math.ceil(Math.sqrt(images.length) - 1));
          var colW = (bbox.w - gap * (ncols - 1)) / ncols;
          var heights = [];
          for (var i = 0; i < ncols; i++) heights.push(bbox.y);
          images.forEach(function (img2, j) {
            var ratio2 = (img2.data.naturalH || img2.h) / (img2.data.naturalW || img2.w);
            var ci = j % ncols;
            var w2 = colW;
            var h2 = w2 * ratio2;
            img2.w = Math.round(w2);
            img2.h = Math.round(h2);
            img2.x = Math.round(bbox.x + ci * (colW + gap));
            img2.y = Math.round(heights[ci]);
            heights[ci] += h2 + gap;
          });
        } else if (mode === 'collage') {
          images.forEach(function (img3, k) {
            img3.rotation = Math.round((Math.random() - 0.5) * 14);
            var jx = (Math.random() - 0.5) * bbox.w * 0.18;
            var jy = (Math.random() - 0.5) * bbox.h * 0.18;
            img3.x = Math.round(bbox.x + jx + (k % 3) * 24);
            img3.y = Math.round(bbox.y + jy + Math.floor(k / 3) * 18);
          });
        }
        var ids = images.map(function (x) {
          return x.id;
        });
        MB.store.emit('element', { ids: ids });
      });
      MB.store.emit('selection');
    }
  };

  MB.app = App;

  /* ------------------------------------------------------ panneaux */

  function bindPanels() {
    var lib = document.getElementById('library');
    var insp = document.getElementById('inspector');
    var tabL = document.getElementById('btn-library-open');
    var tabR = document.getElementById('btn-inspector-open');

    function apply() {
      var st = MB.store.s();
      lib.classList.toggle('is-closed', !st.ui.libraryOpen);
      insp.classList.toggle('is-closed', !st.ui.inspectorOpen);
      tabL.hidden = st.ui.libraryOpen;
      tabR.hidden = st.ui.inspectorOpen;
      setTimeout(function () {
        MB.board.refreshOverlay();
      }, 190);
    }

    document.getElementById('btn-library-close').innerHTML = MB.icons.get('chevronLeft', 14);
    document.getElementById('btn-inspector-close').innerHTML = MB.icons.get('chevronRight', 14);
    document.getElementById('btn-library-open').innerHTML = MB.icons.get('chevronRight', 14);
    document.getElementById('btn-inspector-open').innerHTML = MB.icons.get('chevronLeft', 14);

    document.getElementById('btn-library-close').addEventListener('click', function () {
      MB.store.setUI({ libraryOpen: false });
    });
    document.getElementById('btn-inspector-close').addEventListener('click', function () {
      MB.store.setUI({ inspectorOpen: false });
    });
    tabL.addEventListener('click', function () {
      MB.store.setUI({ libraryOpen: true });
    });
    tabR.addEventListener('click', function () {
      MB.store.setUI({ inspectorOpen: true });
    });

    MB.store.on('ui', function (patch) {
      if (patch && (patch.libraryOpen !== undefined || patch.inspectorOpen !== undefined)) {
        apply();
      }
    });
    apply();

    // Panneaux auto-repliés sous 980 px (mobile / panneau CEP étroit).
    // Évalué au boot ET au resize (débounce) : redimensionner la fenêtre
    // de l'hôte (Illustrateur ou navigateur) ne doit jamais écraser le
    // canvas à 0 px — les panneaux se replient et se rétablissent.
    var narrow = window.innerWidth < 980;
    if (narrow) {
      MB.store.setUI({ libraryOpen: false, inspectorOpen: false });
    }
    window.addEventListener('resize', U.debounce(function () {
      var nowNarrow = window.innerWidth < 980;
      if (nowNarrow !== narrow) {
        narrow = nowNarrow;
        MB.store.setUI({ libraryOpen: !narrow, inspectorOpen: !narrow });
      }
    }, 150));
  }

  /* ------------------------------------------------------ statusbar */

  function bindStatusbar() {
    var wrap = document.getElementById('board-wrap');
    var versionEl = document.getElementById('sb-version');
    if (versionEl)
      versionEl.textContent = 'v' + (MB.VERSION || '?') + (MB.desktop && MB.desktop.active ? ' · Desktop' : '');
    MB.store.on('elements', statusCounts);
    MB.store.on('selection', statusCounts);
    MB.store.on('tool', function (tool) {
      wrap.dataset.tool = tool;
      MB.ui.toolbar.refresh && MB.ui.toolbar.refresh();
    });
    wrap.dataset.tool = MB.store.s().tool;
  }

  function statusCounts() {
    var node = document.getElementById('sb-count');
    if (!node) return;
    var st = MB.store.s();
    var n = st.elements.length;
    var s = st.selection.ids.length;
    node.textContent = n + ' élément' + (n > 1 ? 's' : '') + (s ? ' · ' + s + ' sélectionné' + (s > 1 ? 's' : '') : '');
  }

  /* ------------------------------------------------------ clavier */

  function bindKeyboard() {
    window.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

      // Échap : comportement contextuel (§28)
      if (e.key === 'Escape') {
        if (typing) return; // laissé au champ (annulation d'édition texte)
        if (MB.interact.handleEscape()) e.preventDefault();
        return;
      }

      if (typing) return;

      // Suppression (§29) — Delete ET Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (MB.store.selectedIds().length) {
          e.preventDefault();
          MB.store.deleteSelection();
        }
        return;
      }

      if (mod) {
        var k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) MB.hist.redo();
          else MB.hist.undo();
          return;
        }
        if (k === 'y') {
          e.preventDefault();
          MB.hist.redo();
          return;
        }
        if (k === 'c') {
          MB.store.copySelection();
          if (MB.store.selectedIds().length) MB.ui.toast('Copié', 'success');
          return;
        }
        if (k === 'x') {
          MB.store.cutSelection();
          return;
        }
        if (k === 'v') {
          MB.store.pasteClipboard();
          return;
        }
        if (k === 'd') {
          e.preventDefault();
          MB.store.duplicateSelection();
          return;
        }
        if (k === 'a') {
          e.preventDefault();
          MB.store.selectAll();
          return;
        }
        if (k === 'g') {
          e.preventDefault();
          if (e.shiftKey) MB.store.ungroupSelection();
          else MB.store.groupSelection();
          return;
        }
        if (k === 's') {
          e.preventDefault();
          MB.storage.save();
          return;
        }
        if (k === 'o') {
          e.preventDefault();
          MB.storage.open();
          return;
        }
        if (k === '0') {
          e.preventDefault();
          MB.camera.setZoom(1);
          return;
        }
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        MB.ui.shortcutsDialog();
        return;
      }

      // ⇧1 = Ajuster à l'écran, ⇧2 = Zoom sur la sélection
      // (les touches shiftées produisent '!' et '@' sur la plupart des claviers)
      if (e.shiftKey && (e.key === '!' || e.key === '1')) {
        MB.camera.fit(null);
        return;
      }
      if (e.shiftKey && (e.key === '@' || e.key === '2')) {
        MB.camera.fitSelection();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
        return;
      }
      if (e.key === '0') {
        MB.camera.setZoom(1);
        return;
      }
    });

    window.addEventListener('beforeunload', function (e) {
      // Application autonome : la confirmation de fermeture est gérée par le
      // processus principal (dialogue natif) — la page ne bloque pas.
      if (MB.desktop && MB.desktop.active) return;
      if (MB.store.s().ui.saveState !== 'saved') {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
