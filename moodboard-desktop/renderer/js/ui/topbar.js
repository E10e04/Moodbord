/* =========================================================================
 * topbar.js — Barre supérieure : marque, menus, nom du projet,
 * contrôles zoom, toggles, indicateur de sauvegarde.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  function m(label, action, kbd, opts) {
    return {
      label: label,
      action: action,
      kbd: kbd || '',
      disabled: (opts && opts.disabled) || false,
      check: (opts && opts.check) || null,
      sep: false
    };
  }

  function sep() {
    return { sep: true };
  }

  function buildMenus() {
    return [
      {
        title: 'Fichier',
        items: [
          m('Nouveau moodboard', function () {
            MB.app.newBoard();
          }, ''),
          m('Ouvrir…', function () {
            MB.storage.open();
          }, '⌘O'),
          m('Enregistrer', function () {
            MB.storage.save();
          }, '⌘S'),
          m('Enregistrer sous…', function () {
            MB.storage.saveAs();
          }, '⇧⌘S'),
          sep(),
          m('Importer des images…', function () {
            MB.interact.openImportPicker(null);
          }, ''),
          m('Charger le tableau de démonstration', function () {
            MB.app.loadDemo(true);
          }, ''),
          sep(),
          m('Exporter le PNG…', function () {
            MB.exporter.exportPng(null);
          }, ''),
          m('Exporter le SVG…', function () {
            MB.exporter.exportSvg(null);
          }, ''),
          m('Exporter la sélection en SVG…', function () {
            MB.exporter.exportSvg(MB.store.selected());
          }, '')
        ]
      },
      {
        title: 'Édition',
        items: [
          m('Annuler', function () {
            var label = MB.hist.undo();
            if (!label) MB.ui.toast('Rien à annuler', 'info');
          }, '⌘Z', {
            check: function () {
              return MB.hist.canUndo();
            }
          }),
          m('Rétablir', function () {
            var label = MB.hist.redo();
            if (!label) MB.ui.toast('Rien à rétablir', 'info');
          }, '⇧⌘Z', {
            check: function () {
              return MB.hist.canRedo();
            }
          }),
          sep(),
          m('Couper', function () {
            MB.store.cutSelection();
          }, '⌘X'),
          m('Copier', function () {
            MB.store.copySelection();
            if (MB.store.selectedIds().length) MB.ui.toast('Copié', 'success');
          }, '⌘C'),
          m('Coller', function () {
            MB.store.pasteClipboard();
          }, '⌘V'),
          m('Dupliquer', function () {
            MB.store.duplicateSelection();
          }, '⌘D'),
          m('Supprimer', function () {
            MB.store.deleteSelection();
          }, '⌫'),
          sep(),
          m('Tout sélectionner', function () {
            MB.store.selectAll();
          }, '⌘A'),
          m('Désélectionner', function () {
            MB.store.clearSelection();
          }, 'Échap')
        ]
      },
      {
        title: 'Objet',
        items: [
          m('Grouper', function () {
            MB.store.groupSelection();
          }, '⌘G'),
          m('Dissocier', function () {
            MB.store.ungroupSelection();
          }, '⇧⌘G'),
          sep(),
          m('Verrouiller / déverrouiller', function () {
            MB.app.toggleLock();
          }, ''),
          m('Masquer', function () {
            MB.app.toggleHide(true);
          }, ''),
          m('Révéler tout', function () {
            MB.app.revealAll();
          }, ''),
          sep(),
          m('Premier plan', function () {
            MB.app.reorderSelection('front');
          }, ''),
          m('Avancer', function () {
            MB.app.reorderSelection('forward');
          }, ''),
          m('Reculer', function () {
            MB.app.reorderSelection('backward');
          }, ''),
          m('Arrière-plan', function () {
            MB.app.reorderSelection('back');
          }, '')
        ]
      },
      {
        title: 'Affichage',
        items: [
          m('Zoom avant', function () {
            MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
          }, '+'),
          m('Zoom arrière', function () {
            MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
          }, '−'),
          m('Zoom 100 %', function () {
            MB.camera.setZoom(1);
          }, '⌘0'),
          m('Ajuster à l’écran', function () {
            MB.camera.fit(null);
          }, '⇧1'),
          m('Zoom sur la sélection', function () {
            MB.camera.fitSelection();
          }, '⇧2'),
          sep(),
          m('Grille de points', function () {
            MB.store.setUI({ grid: !MB.store.s().ui.grid });
          }, 'G', {
            check: function () {
              return MB.store.s().ui.grid;
            }
          }),
          m('Aimantage intelligent', function () {
            MB.store.setUI({ snap: !MB.store.s().ui.snap });
          }, '', {
            check: function () {
              return MB.store.s().ui.snap;
            }
          }),
          sep(),
          m('Bibliothèque', function () {
            MB.app.togglePanel('library');
          }, '', {
            check: function () {
              return MB.store.s().ui.libraryOpen;
            }
          }),
          m('Inspecteur', function () {
            MB.app.togglePanel('inspector');
          }, '', {
            check: function () {
              return MB.store.s().ui.inspectorOpen;
            }
          })
        ]
      },
      {
        title: 'Illustrateur',
        items: [
          m('Importer la palette du document…', function () {
            MB.cep.importDocSwatches();
          }, ''),
          m('Envoyer les couleurs sélectionnées…', function () {
            MB.cep.sendColorsToIllustrator();
          }, ''),
          m('Placer l’image sélectionnée…', function () {
            MB.cep.placeSelectedImage();
          }, ''),
          sep(),
          m('Informations du document…', function () {
            MB.cep.showDocInfo();
          }, '')
        ]
      },
      {
        title: 'Aide',
        items: [
          m('Raccourcis clavier', function () {
            MB.ui.shortcutsDialog();
          }, '?'),
          m('Diagnostics…', function () {
            MB.ui.diagnosticsDialog();
          }, ''),
          m('À propos', function () {
            MB.ui.aboutDialog();
          }, '')
        ]
      }
    ];
  }

  var openMenu = null;

  function closeMenu() {
    if (openMenu) {
      openMenu.el.classList.remove('is-open');
      openMenu = null;
      document.removeEventListener('pointerdown', menuDocDown, true);
      document.removeEventListener('mousedown', menuDocDown, true);
    }
  }

  function menuDocDown(e) {
    if (openMenu && !openMenu.wrap.contains(e.target)) closeMenu();
  }

  function init() {
    var bar = document.getElementById('menubar');
    var menus = buildMenus();

    menus.forEach(function (menu) {
      var wrap = U.el('div', 'menu-wrap');
      var trig = U.el('button', 'menu-trigger', U.escapeHtml(menu.title));
      trig.type = 'button';
      var list = U.el('div', 'menu');
      wrap.appendChild(trig);
      wrap.appendChild(list);

      trig.addEventListener('click', function () {
        if (openMenu && openMenu.el === list) {
          closeMenu();
          return;
        }
        closeMenu();
        renderMenuList(list, menu.items);
        list.classList.add('is-open');
        openMenu = { el: list, wrap: wrap };
        setTimeout(function () {
          document.addEventListener('pointerdown', menuDocDown, true);
          // Repli souris (moteurs CEP sans Pointer Events) — idempotent.
          document.addEventListener('mousedown', menuDocDown, true);
        }, 0);
      });

      bar.appendChild(wrap);
    });

    // nom du projet
    var nameInput = document.getElementById('proj-name');
    nameInput.addEventListener('change', function () {
      MB.store.setProject({ name: nameInput.value || 'Sans titre' });
      MB.storage.markDirty();
    });
    MB.store.on('project', function (p) {
      if (p && p.name !== undefined && nameInput.value !== p.name) {
        nameInput.value = p.name;
      }
    });

    // boutons droite
    document.getElementById('btn-zoom-in').innerHTML = MB.icons.get('zoomIn', 16);
    document.getElementById('btn-zoom-out').innerHTML = MB.icons.get('zoomOut', 16);
    document.getElementById('btn-snap').innerHTML = MB.icons.get('magnet', 16);
    document.getElementById('btn-grid').innerHTML = MB.icons.get('grid', 16);
    document.getElementById('btn-library').innerHTML = MB.icons.get('layers', 16);
    document.getElementById('btn-inspector').innerHTML = MB.icons.get('more', 16);

    document.getElementById('btn-zoom-in').addEventListener('click', function () {
      MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', function () {
      MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
    });
    document.getElementById('zoom-val').addEventListener('click', function () {
      zoomMenu(this);
    });
    document.getElementById('btn-snap').addEventListener('click', function () {
      MB.store.setUI({ snap: !MB.store.s().ui.snap });
    });
    document.getElementById('btn-grid').addEventListener('click', function () {
      MB.store.setUI({ grid: !MB.store.s().ui.grid });
    });
    document.getElementById('btn-library').addEventListener('click', function () {
      MB.app.togglePanel('library');
    });
    document.getElementById('btn-inspector').addEventListener('click', function () {
      MB.app.togglePanel('inspector');
    });

    // état de sauvegarde
    MB.store.on('ui', function (patch) {
      if (patch && patch.saveState !== undefined) refreshSave();
    });
    refreshSave();
    refreshZoom();
    refreshToggles();
    MB.store.on('camera', refreshZoom);
    MB.store.on('ui', function (patch) {
      if (patch && (patch.snap !== undefined || patch.grid !== undefined || patch.libraryOpen !== undefined || patch.inspectorOpen !== undefined)) {
        refreshToggles();
      }
    });
    MB.store.on('camera', function () {});
  }

  function zoomMenu(anchor) {
    MB.ui.popover(anchor, '' +
      '<button class="ctx-pop-item" data-z="50">50 %</button>' +
      '<button class="ctx-pop-item" data-z="100">100 %</button>' +
      '<button class="ctx-pop-item" data-z="200">200 %</button>' +
      '<button class="ctx-pop-item" data-z="fit">Ajuster à l’écran</button>' +
      '<button class="ctx-pop-item" data-z="sel">Zoom sur la sélection</button>', {
      bind: function (p) {
        p.querySelectorAll('[data-z]').forEach(function (b) {
          b.addEventListener('click', function () {
            MB.ui.closePopover();
            var z = b.dataset.z;
            if (z === 'fit') MB.camera.fit(null);
            else if (z === 'sel') MB.camera.fitSelection();
            else MB.camera.setZoom(parseInt(z, 10) / 100);
          });
        });
      }
    });
  }

  function renderMenuList(list, items) {
    list.innerHTML = '';
    items.forEach(function (it) {
      if (it.sep) {
        list.appendChild(U.el('div', 'menu-sep'));
        return;
      }
      var disabled = false;
      if (it.check) disabled = it.check() === false && it.forceEnable !== true;
      var row = U.el(
        'div',
        'menu-item' + (disabled ? ' is-disabled' : '')
      );
      row.innerHTML =
        '<span class="menu-label">' + U.escapeHtml(it.label) + '</span>' +
        (it.kbd ? '<span class="menu-kbd">' + U.escapeHtml(it.kbd) + '</span>' : '');
      if (!disabled) {
        row.addEventListener('click', function () {
          closeMenu();
          try {
            it.action();
          } catch (err) {
            console.error(err);
            MB.ui.toast('Action impossible : ' + err.message, 'error');
          }
        });
      }
      list.appendChild(row);
    });
  }

  function refreshSave() {
    var st = MB.store.s().ui.saveState;
    var dot = document.getElementById('save-dot');
    var label = document.getElementById('save-label');
    if (!dot) return;
    dot.className = 'save-dot save-dot--' + st;
    label.textContent =
      st === 'saved' ? 'Enregistré' :
      st === 'saving' ? 'Enregistrement…' : 'Modifié';
  }

  function refreshZoom() {
    var el = document.getElementById('zoom-val');
    if (!el) return;
    el.textContent = Math.round(MB.store.s().camera.zoom * 100) + ' %';
  }

  function refreshToggles() {
    var st = MB.store.s().ui;
    var snap = document.getElementById('btn-snap');
    var grid = document.getElementById('btn-grid');
    snap.classList.toggle('is-on', st.snap);
    grid.classList.toggle('is-on', st.grid);
    snap.style.color = st.snap ? 'var(--accent)' : '';
    grid.style.color = st.grid ? 'var(--accent)' : '';
  }

  MB.ui = MB.ui || {};
  MB.ui.topbar = { init: init, closeMenu: closeMenu };
})();
