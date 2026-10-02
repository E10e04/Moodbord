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
    if (MB.boards) MB.boards.init(); // v1.6 — planches liées
    if (MB.fonts) MB.fonts.init(); // v1.6 — polices système + police par défaut
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
    if (MB.ui.home) MB.ui.home.init(); // v1.3 — écran d'accueil (bureau uniquement, inerte ailleurs)
    bindKeyboard();
    bindKeyboardFocus();
    bindPanels();
    bindStatusbar();
    firstRun();
    statusCounts();
  }

  /* ------------------------------------------------ premier lancement */

  function firstRun() {
    /* v1.3 — Application de bureau : écran d'accueil au démarrage
     * (récents, reprise de session, nouveau moodboard). Le canvas ne
     * charge NI autosave NI démo tant que l'utilisateur n'a pas choisi. */
    if (MB.ui.home && MB.ui.home.showAtBoot()) return;

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
      if (MB.boards) MB.boards.reset();
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
    /* Depuis l'écran d'accueil : garde spécifique (l'autosave d'un
     * travail non enregistré est le seul risque, le tableau affiché
     * derrière l'accueil est vide). */
    if (MB.ui.home && MB.ui.home.visible()) {
      MB.ui.home.newBoard();
      return;
    }
    MB.ui.confirmDialog({
      title: 'Nouveau moodboard',
      message: 'Effacer le tableau courant ? Les modifications non enregistrées seront perdues.',
      confirmLabel: 'Nouveau tableau',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      if (MB.boards) MB.boards.reset();
      MB.store.loadDocument({ name: 'Sans titre', elements: [] });
      MB.camera.fit(null);
      MB.storage.markSaved();
      MB.storage.clearAutosave();
      MB.ui.toast('Nouveau tableau', 'success');
    });
  }

  /* ------------------------------------------------------ actions */

  var App = {
    newBoard: newBoard,
    loadDemo: loadDemo,

    /* v1.6 — suppression avec garde : une planche liée qui contient du
     * travail mérite une confirmation explicite. */
    deleteSelection: function () {
      var sel = MB.store.selected();
      var heavy = sel.filter(function (e) {
        return e.type === 'board' && e.data && e.data.doc && Array.isArray(e.data.doc.elements) && e.data.doc.elements.length > 0;
      });
      var go = function () {
        MB.store.deleteSelection();
      };
      if (heavy.length) {
        var n = heavy.reduce(function (acc, e) {
          return acc + e.data.doc.elements.length;
        }, 0);
        MB.ui.confirmDialog({
          title: heavy.length > 1 ? 'Supprimer les planches liées ?' : 'Supprimer la planche liée ?',
          message:
            heavy.length > 1
              ? heavy.length + ' planches seront supprimées avec tout leur contenu (' + n + ' éléments au total).'
              : 'La planche « ' + (heavy[0].data.title || 'Planche') + ' » contient ' + n + ' élément(s) — tout son contenu sera définitivement supprimé.',
          confirmLabel: 'Supprimer',
          danger: true
        }).then(function (ok) {
          if (ok) go();
        });
        return;
      }
      go();
    },

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

  /* Focus clavier — le correctif « raccourcis morts » des panneaux CEP.
   *
   * Mesure v1.1.3 (rapport utilisateur) : keydown=0, keyup=0 sur toute
   * une session de travail — le panneau ne reçoit JAMAIS le clavier.
   * Dans les panneaux CEP d'Illustrator, cliquer un élément non
   * focusable (canvas, item de bibliothèque, barre d'outils) ne donne
   * PAS le focus clavier au panneau : seuls les champs de saisie le
   * captent. Tant que le document ne porte pas le focus, la fenêtre
   * n'émet aucun keydown — tous les raccourcis restent morts.
   *
   * Remède (astuce standard CEP) :
   *  - <body tabindex="0"> : le document PEUT porter le focus ;
   *  - à CHAQUE pression dans le panneau (capture), si la cible n'est
   *    pas un champ de saisie, le focus est rendu au document — un
   *    clic sur un bouton garde le focus du bouton (l'action par
   *    défaut du mousedown s'exécute après la capture), un clic sur
   *    le canvas/bibliothèque arme le clavier du panneau ;
   *  - la pastille de la barre d'état (⌨) affiche l'état réel et se
   *    réarme d'un clic : cliquer dans Illustrator désactive les
   *    raccourcis (comportement attendu), cliquer dans le panneau les
   *    réactive. */
  var kbdChip = null;

  function setKbd(on) {
    if (!kbdChip) return;
    var state = !!on;
    kbdChip.classList.toggle('is-on', state);
    kbdChip.classList.toggle('is-off', !state);
    kbdChip.textContent = state ? '⌨ raccourcis actifs' : '⌨ raccourcis inactifs — cliquez ici';
    kbdChip.setAttribute(
      'aria-label',
      state
        ? 'Raccourcis clavier actifs'
        : 'Raccourcis clavier inactifs — cliquez dans le panneau pour les activer'
    );
  }

  function claimKeyboardFocus(e) {
    try {
      var t = e && e.target;
      if (!U.isTextField(t)) {
        if (document.body && document.activeElement !== document.body) document.body.focus();
        window.focus();
      }
    } catch (err) {
      /* jamais bloquant */
    }
    setKbd(true);
  }

  function bindKeyboardFocus() {
    if (document.body) document.body.setAttribute('tabindex', '0');
    // Capture : avant tout autre traitement, avant le focus par défaut
    // de la cible — le relais souris couvre les moteurs CEP sans
    // Pointer Events.
    document.addEventListener('pointerdown', claimKeyboardFocus, true);
    document.addEventListener('mousedown', claimKeyboardFocus, true);

    kbdChip = document.getElementById('sb-kbd');
    if (kbdChip) {
      kbdChip.addEventListener('click', function () {
        claimKeyboardFocus();
      });
    }

    window.addEventListener('focus', function () {
      setKbd(true);
    });
    window.addEventListener('blur', function () {
      setKbd(false);
    });
    setKbd(typeof document.hasFocus === 'function' ? document.hasFocus() : true);
  }

  /* Déplacement clavier de la sélection (flèches) — même mécanique que le
   * drag : un pas = 1 px écran converti en unités monde selon le zoom,
   * ⇧ = ×10 (comme Illustrator). Les lignes déplacent leurs extrémités,
   * l'opération entre dans l'historique (annulable). */
  function nudgeSelection(e) {
    var st = MB.store.s();
    if (!st.selection.ids.length) return;
    e.preventDefault();
    var step = (e.shiftKey ? 10 : 1) / (st.camera.zoom || 1);
    var dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    var dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    var origins = {};
    var any = false;
    MB.store.selectionClosure().forEach(function (id) {
      var el = MB.store.el(id);
      if (!el || el.locked) return;
      var o = { x: el.x, y: el.y };
      if (el.type === 'line' && el.data) {
        o.x1 = el.data.x1;
        o.y1 = el.data.y1;
        o.x2 = el.data.x2;
        o.y2 = el.data.y2;
      }
      origins[id] = o;
      any = true;
    });
    if (!any) return;
    MB.hist.begin('Déplacer (clavier)');
    MB.store.applyDelta(origins, dx, dy);
    MB.hist.commit();
  }

  /* v1.6 — Presse-papiers d'un champ d'interface (INPUT/TEXTAREA) :
   * ⌘A sélectionne tout le champ, ⌘C copie la sélection, ⌘X coupe.
   * preventDefault + opération manuelle : le comportement devient
   * identique dans le panneau CEP, l'application et le navigateur. */
  function fieldClipboard(e, k, t) {
    if (k === 'a') {
      if (typeof t.select === 'function') {
        e.preventDefault();
        t.select();
      }
      return;
    }
    var s = t.selectionStart;
    var epos = t.selectionEnd;
    if (typeof s !== 'number' || typeof epos !== 'number' || epos <= s) return;
    var sel = t.value.substring(s, epos);
    e.preventDefault();
    MB.clip.copyText(sel).then(function (ok) {
      if (!ok) {
        MB.ui.toast('Copie impossible — utilisez le clic droit du champ.', 'error');
        return;
      }
      if (k === 'x') {
        t.value = t.value.slice(0, s) + t.value.slice(epos);
        t.setSelectionRange(s, s);
        try {
          t.dispatchEvent(new Event('input', { bubbles: true }));
          t.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) { /* vieux moteurs */ }
      }
    });
  }

  function bindKeyboard() {
    // Capture : on voit les touches AVANT tout stopPropagation d'un
    // enfant (les gardes « typing » ci-dessous protègent l'édition).
    window.addEventListener('keydown', function (e) {
      /* v1.3 — écran d'accueil visible : les raccourcis du canvas
       * n'ont rien à faire (rien de sélectionnable derrière). */
      if (MB.ui.home && MB.ui.home.visible() && e.key !== 'Escape') return;

      var mod = e.metaKey || e.ctrlKey;
      var t = e.target;
      var typing = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));

      /* Trois contextes de saisie, trois politiques :
       *  - ÉDITION SUR CANVAS (.is-editing) et DIALOGUES : le champ garde
       *    tout (ses écouteurs stoppent d'ailleurs la propagation).
       *  - CHAMP D'INTERFACE (ex. nom du projet en barre supérieure) :
       *    les raccourcis APPLICATIFS à modificateur restent actifs —
       *    Illustrator fait de même (⌘Z/⌘S/⌘D… marchent pendant qu'on
       *    tape dans un champ de panneau). ⌘A/⌘C/⌘X/⌘V restent au champ
       *    (sélection/copie du texte tapé, comportement natif attendu).
       *  - HORS SAISIE : tout est actif. */
      var inDialog = typing && t.closest && !!t.closest('.dialog');
      var onCanvasEditor = typing && t.classList && t.classList.contains('is-editing');
      var fieldOnly = inDialog || onCanvasEditor;
      var uiField = typing && !fieldOnly;

      // Échap : comportement contextuel (§28)
      if (e.key === 'Escape') {
        if (uiField) {
          // Champ d'interface : rendre le clavier à l'application — sans
          // cela, un clic dans le nom du projet tuait TOUS les raccourcis
          // sans aucun indice visuel (piège silencieux).
          e.preventDefault();
          t.blur();
          return;
        }
        if (typing) return; // édition canvas / dialogue : laissé au champ
        if (MB.interact.handleEscape()) e.preventDefault();
        return;
      }

      if (fieldOnly) return;

      // Suppression (§29) — Delete ET Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!typing && MB.store.selectedIds().length) {
          e.preventDefault();
          MB.app.deleteSelection();
        }
        return;
      }

      // v1.6 — Alt+← : sortir d'une planche liée (retour au parent)
      if (!typing && e.altKey && (e.key === 'ArrowLeft' || e.key === 'Left')) {
        if (MB.boards && MB.boards.insideBoard()) {
          e.preventDefault();
          MB.boards.exit();
        }
        return;
      }

      // Flèches : déplacer la sélection (1 px écran, ⇧ = ×10)
      if (!typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        nudgeSelection(e);
        return;
      }

      if (mod) {
        var k = e.key.toLowerCase();

        // Pendant une saisie d'interface : les raccourcis TEXTE restent
        // au champ (sélectionner/copier le mot tapé, pas le tableau).
        // v1.6 — traitement EXPLICITE (⌘A/⌘C/⌘X) : selon l'hôte
        // (Illustrator peut voler les raccourcis du panneau), le natif
        // n'arrive pas toujours au champ — on applique l'opération
        // manuellement pour INPUT/TEXTAREA (le contenteditable du canvas
        // est géré par attachEditingKeys). ⌘V reste natif (la lecture du
        // presse-papiers ne peut pas être garantie partout — l'inspecteur
        // des liens fournit un bouton « Coller » dédié).
        if (typing && (k === 'a' || k === 'c' || k === 'x')) {
          if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
            fieldClipboard(e, k, t);
          }
          return;
        }
        if (typing && k === 'v') return;

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
        if (k === 's') {
          e.preventDefault();
          if (e.shiftKey) MB.storage.saveAs();
          else MB.storage.save();
          return;
        }
        if (k === 'o') {
          e.preventDefault();
          MB.storage.open();
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
        if (k === 'c') {
          e.preventDefault();
          MB.store.copySelection();
          if (MB.store.selectedIds().length) MB.ui.toast('Copié', 'success');
          return;
        }
        if (k === 'x') {
          e.preventDefault();
          MB.store.cutSelection();
          return;
        }
        if (k === 'v') {
          e.preventDefault();
          MB.store.pasteClipboard();
          return;
        }
        if (k === 'g') {
          e.preventDefault();
          if (e.shiftKey) MB.store.ungroupSelection();
          else MB.store.groupSelection();
          return;
        }
        // Zoom au modificateur — LE raccourci standard macOS (⌘+ / ⌘−).
        // « + » exige ⇧ sur AZERTY : le test porte sur la touche, pas la
        // combinaison exacte (⇧⌘= doit zoomer aussi).
        if (k === '+' || k === '=') {
          e.preventDefault();
          MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
          return;
        }
        if (k === '-' || k === '_') {
          e.preventDefault();
          MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
          return;
        }
        if (k === '0') {
          e.preventDefault();
          MB.camera.setZoom(1);
          return;
        }
        return;
      }

      if (typing) return;

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
    }, true);

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
