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

  /* v1.9 — menus localisés (MB.i18n.t). */
  function T(k) {
    return MB.i18n ? MB.i18n.t(k) : k;
  }

  function buildMenus() {
    return [
      {
        title: T('menu.file'),
        items: [
          m(T('menu.new'), function () {
            MB.app.newBoard();
          }, ''),
          m(T('menu.open'), function () {
            MB.storage.open();
          }, '⌘O'),
          m(T('menu.save'), function () {
            MB.storage.save();
          }, '⌘S'),
          m(T('menu.saveas'), function () {
            MB.storage.saveAs();
          }, '⇧⌘S'),
          sep(),
          m(T('menu.import'), function () {
            MB.interact.openImportPicker(null);
          }, ''),
          m(T('menu.demo'), function () {
            MB.app.loadDemo(true);
          }, ''),
          sep(),
          m(T('menu.exportPng'), function () {
            MB.exporter.exportPng(null);
          }, ''),
          m(T('menu.exportSvg'), function () {
            MB.exporter.exportSvg(null);
          }, ''),
          m(T('menu.exportSel'), function () {
            MB.exporter.exportSvg(MB.store.selected());
          }, ''),
          sep(),
          /* v1.7 — dossier des fichiers temporaires et autosaves. */
          m(T('menu.prefs'), function () {
            MB.ui.preferencesDialog();
          }, '⌘,')
        ]
      },
      {
        title: T('menu.edit'),
        items: [
          m(T('menu.undo'), function () {
            var label = MB.hist.undo();
            if (!label) MB.ui.toast(T('toast.nothingUndo'), 'info');
          }, '⌘Z', {
            check: function () {
              return MB.hist.canUndo();
            }
          }),
          m(T('menu.redo'), function () {
            var label = MB.hist.redo();
            if (!label) MB.ui.toast(T('toast.nothingRedo'), 'info');
          }, '⇧⌘Z', {
            check: function () {
              return MB.hist.canRedo();
            }
          }),
          sep(),
          m(T('menu.cut'), function () {
            MB.store.cutSelection();
          }, '⌘X'),
          m(T('menu.copy'), function () {
            MB.store.copySelection();
            if (MB.store.selectedIds().length) MB.ui.toast(T('toast.copied'), 'success');
          }, '⌘C'),
          m(T('menu.paste'), function () {
            MB.store.pasteClipboard();
          }, '⌘V'),
          m(T('menu.duplicate'), function () {
            MB.store.duplicateSelection();
          }, '⌘D'),
          m(T('menu.delete'), function () {
            MB.store.deleteSelection();
          }, '⌫'),
          sep(),
          m(T('menu.selectAll'), function () {
            MB.store.selectAll();
          }, '⌘A'),
          m(T('menu.deselect'), function () {
            MB.store.clearSelection();
          }, 'Échap')
        ]
      },
      {
        title: T('menu.object'),
        items: [
          m(T('menu.group'), function () {
            MB.store.groupSelection();
          }, '⌘G'),
          m(T('menu.ungroup'), function () {
            MB.store.ungroupSelection();
          }, '⇧⌘G'),
          sep(),
          m(T('menu.lock'), function () {
            MB.app.toggleLock();
          }, ''),
          m(T('menu.hide'), function () {
            MB.app.toggleHide(true);
          }, ''),
          m(T('menu.revealAll'), function () {
            MB.app.revealAll();
          }, ''),
          sep(),
          m(T('menu.front'), function () {
            MB.app.reorderSelection('front');
          }, ''),
          m(T('menu.forward'), function () {
            MB.app.reorderSelection('forward');
          }, ''),
          m(T('menu.backward'), function () {
            MB.app.reorderSelection('backward');
          }, ''),
          m(T('menu.back'), function () {
            MB.app.reorderSelection('back');
          }, '')
        ]
      },
      {
        title: T('menu.view'),
        items: [
          m(T('menu.zoomIn'), function () {
            MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
          }, '+'),
          m(T('menu.zoomOut'), function () {
            MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
          }, '−'),
          m(T('menu.zoom100'), function () {
            MB.camera.setZoom(1);
          }, '⌘0'),
          m(T('menu.fit'), function () {
            MB.camera.fit(null);
          }, '⇧1'),
          m(T('menu.zoomSel'), function () {
            MB.camera.fitSelection();
          }, '⇧2'),
          sep(),
          m(T('menu.grid'), function () {
            MB.store.setUI({ grid: !MB.store.s().ui.grid });
          }, 'G', {
            check: function () {
              return MB.store.s().ui.grid;
            }
          }),
          m(T('menu.snap'), function () {
            MB.store.setUI({ snap: !MB.store.s().ui.snap });
          }, '', {
            check: function () {
              return MB.store.s().ui.snap;
            }
          }),
          sep(),
          m(T('menu.library'), function () {
            MB.app.togglePanel('library');
          }, '', {
            check: function () {
              return MB.store.s().ui.libraryOpen;
            }
          }),
          m(T('menu.inspector'), function () {
            MB.app.togglePanel('inspector');
          }, '', {
            check: function () {
              return MB.store.s().ui.inspectorOpen;
            }
          })
        ]
      },
      {
        title: T('menu.illustrator'),
        items: [
          m(T('menu.cep.swatches'), function () {
            MB.cep.importDocSwatches();
          }, ''),
          m(T('menu.cep.send'), function () {
            MB.cep.sendColorsToIllustrator();
          }, ''),
          m(T('menu.cep.place'), function () {
            MB.cep.placeSelectedImage();
          }, ''),
          sep(),
          m(T('menu.cep.docinfo'), function () {
            MB.cep.showDocInfo();
          }, '')
        ]
      },
      {
        title: T('menu.help'),
        items: [
          m(T('menu.shortcuts'), function () {
            MB.ui.shortcutsDialog();
          }, '?'),
          m(T('menu.diagnostics'), function () {
            MB.ui.diagnosticsDialog();
          }, ''),
          m(T('menu.about'), function () {
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

    // v1.3 — retour à l'écran d'accueil (application de bureau uniquement) :
    // visible seulement quand le pont Electron est actif.
    var btnHome = document.getElementById('btn-home');
    if (btnHome) {
      btnHome.setAttribute('data-tip', T('app.home'));
      btnHome.setAttribute('aria-label', T('app.home'));
    }
    if (btnHome && MB.storage.isDesktop()) {
      btnHome.innerHTML = MB.icons.get('home', 16);
      btnHome.hidden = false;
      btnHome.addEventListener('click', function () {
        if (MB.ui.home) MB.ui.home.show();
      });
    }

    // v1.6 — fil d'Ariane des planches liées : racine ▸ planche ▸ …
    initCrumb();

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

  /* v1.6 — Fil d'Ariane : « Racine ▸ Planche A ▸ Planche B » — chaque
   * segment (sauf le dernier) ramène au niveau correspondant. */
  function initCrumb() {
    var crumb = document.getElementById('board-crumb');
    if (!crumb) return;

    function render() {
      if (!MB.boards || !MB.boards.insideBoard()) {
        crumb.hidden = true;
        crumb.innerHTML = '';
        return;
      }
      var titles = MB.boards.crumb();
      var html =
        '<button type="button" class="crumb-back" data-back="1"' +
        ' title="Revenir au moodboard parent (Alt+←)" aria-label="Revenir au moodboard parent">' +
        MB.icons.get('chevronLeft', 14) +
        '</button>';
      for (var i = 0; i < titles.length; i++) {
        if (i > 0) {
          html += '<span class="crumb-sep" aria-hidden="true">' + MB.icons.get('chevronRight', 11) + '</span>';
        }
        var last = i === titles.length - 1;
        html +=
          '<button type="button" class="crumb-item' + (last ? ' is-current' : '') + '" data-level="' + i + '"' +
          (last ? ' disabled' : '') +
          ' title="' + U.escapeHtml(last ? titles[i] : 'Revenir à ' + titles[i]) + '">' +
          U.escapeHtml(titles[i]) +
          '</button>';
      }
      crumb.innerHTML = html;
      crumb.hidden = false;
      var back = crumb.querySelector('.crumb-back');
      if (back) {
        back.addEventListener('click', function () {
          if (MB.boards) MB.boards.exit();
        });
      }
      crumb.querySelectorAll('.crumb-item:not(.is-current)').forEach(function (b) {
        b.addEventListener('click', function () {
          var level = parseInt(b.dataset.level, 10);
          if (MB.boards) MB.boards.exitTo(level);
        });
      });
    }

    if (MB.boards && MB.boards.onChange) MB.boards.onChange(render);
    MB.store.on('project', function () {
      render();
    });
    render();
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
      st === 'saved' ? T('save.saved') :
      st === 'saving' ? T('save.saving') : T('save.dirty');
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
