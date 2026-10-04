/* =========================================================================
 * contextmenu.js — Menu contextuel (clic droit) sur objet et sur canvas (§33).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  /* v1.9 — menu contextuel localisé. */
  function T(k, v) {
    return MB.i18n ? MB.i18n.t(k, v) : k;
  }

  var menuEl = null;

  function close() {
    if (menuEl && menuEl.parentNode) {
      menuEl.parentNode.removeChild(menuEl);
    }
    menuEl = null;
    document.removeEventListener('pointerdown', onDoc, true);
    document.removeEventListener('mousedown', onDoc, true);
  }

  function onDoc(e) {
    if (menuEl && !menuEl.contains(e.target)) close();
  }

  function item(label, action, opts) {
    var o = opts || {};
    var it = U.el('div', 'ctxmenu-item' + (o.disabled ? ' is-disabled' : ''));
    it.innerHTML =
      '<span class="menu-label">' + U.escapeHtml(label) + '</span>' +
      (o.kbd ? '<span class="menu-kbd">' + U.escapeHtml(o.kbd) + '</span>' : '');
    if (!o.disabled) {
      it.addEventListener('click', function () {
        close();
        try {
          action();
        } catch (err) {
          console.error(err);
          MB.ui.toast('Action impossible : ' + err.message, 'error');
        }
      });
    }
    return it;
  }

  function sep() {
    return U.el('div', 'ctxmenu-sep');
  }

  function hasSelection() {
    return MB.store.selectedIds().length > 0;
  }

  function selectionHasGroup() {
    return MB.store.selected().some(function (e) {
      return e.type === 'group';
    });
  }

  function titleEditable(el) {
    /* v1.12 — la palette n'a plus de nom éditable SUR la carte (le
     * design « picker » n'en a pas) : il vit dans le panneau Projet.
     * La section est retirée avec son outil. */
    return ['note', 'column', 'checklist', 'color', 'typography', 'link', 'board'].indexOf(el.type) >= 0;
  }

  function show(clientX, clientY, hitEl, canvasPt) {
    close();
    var host = document.getElementById('layer-menus');
    menuEl = U.el('div', 'ctxmenu');

    if (hitEl) {
      var resolved = MB.store.resolveSelectable(hitEl.id) || hitEl;
      var st = MB.store.s();
      if (st.selection.ids.indexOf(resolved.id) < 0) {
        MB.store.setSelection([resolved.id]);
      }

      menuEl.appendChild(item('Copier', function () {
        MB.store.copySelection();
        MB.ui.toast('Copié', 'success');
      }, { kbd: '⌘C' }));
      menuEl.appendChild(item('Dupliquer', function () {
        MB.store.duplicateSelection();
      }, { kbd: '⌘D' }));
      menuEl.appendChild(item('Supprimer', function () {
        MB.app.deleteSelection();
      }, { kbd: '⌫' }));
      if (titleEditable(resolved)) {
        menuEl.appendChild(item(T('home.menuOpen') === 'Open' ? 'Rename' : 'Renommer', function () {
          MB.interact.startEditing(resolved, resolved.type === 'color' || resolved.type === 'palette' || resolved.type === 'typography' ? 'name' : 'title');
        }));
      }
      if (resolved.type === 'board') {
        menuEl.appendChild(item(MB.i18n && MB.i18n.lang() === 'en' ? 'Open board' : 'Ouvrir la planche', function () {
          if (MB.boards) MB.boards.enter(resolved);
        }));
      }
      if (MB.store.selectedIds().length >= 2) {
        menuEl.appendChild(item(T('menu.group'), function () {
          MB.store.groupSelection();
        }, { kbd: '⌘G' }));
      }
      if (selectionHasGroup()) {
        menuEl.appendChild(item(T('menu.ungroup'), function () {
          MB.store.ungroupSelection();
        }, { kbd: '⇧⌘G' }));
      }
      menuEl.appendChild(sep());
      menuEl.appendChild(item(resolved.locked ? (MB.i18n && MB.i18n.lang() === 'en' ? 'Unlock' : 'Déverrouiller') : T('menu.lock'), function () {
        MB.app.toggleLock();
      }));
      menuEl.appendChild(item(T('menu.hide'), function () {
        MB.app.toggleHide(true);
      }));
      menuEl.appendChild(sep());
      menuEl.appendChild(item(T('menu.front'), function () {
        MB.app.reorderSelection('front');
      }));
      menuEl.appendChild(item(T('menu.forward'), function () {
        MB.app.reorderSelection('forward');
      }));
      menuEl.appendChild(item(T('menu.backward'), function () {
        MB.app.reorderSelection('backward');
      }));
      menuEl.appendChild(item(T('menu.back'), function () {
        MB.app.reorderSelection('back');
      }));
      if (resolved.type === 'image') {
        /* v1.11 — images ouvertes au reste du système : copier le
         * BITMAP dans le presse-papiers, enregistrer le fichier sur
         * disque, et l'ajouter à la bibliothèque persistante. */
        menuEl.appendChild(sep());
        menuEl.appendChild(item(T('menu.img.copy'), function () {
          MB.imaging.copyImage(resolved);
        }));
        menuEl.appendChild(item(T('menu.img.save'), function () {
          MB.imaging.downloadImage(resolved);
        }));
        menuEl.appendChild(item(T('menu.img.library'), function () {
          if (MB.ui.library && MB.ui.library.addFromElement) {
            MB.ui.library.addFromElement(resolved);
          }
        }));
      }
      if (resolved.type === 'image' && MB.cep.available()) {
        menuEl.appendChild(sep());
        menuEl.appendChild(item(T('menu.cep.place'), function () {
          MB.cep.placeSelectedImage();
        }));
      }
      if ((resolved.type === 'color' || resolved.type === 'palette') && MB.cep.available()) {
        menuEl.appendChild(item(T('menu.cep.send'), function () {
          MB.cep.sendColorsToIllustrator();
        }));
      }
    } else {
      menuEl.appendChild(item((MB.i18n && MB.i18n.lang() === 'en' ? 'New note' : 'Créer une note'), function () {
        MB.interact.createAt('note', canvasPt);
      }));
      menuEl.appendChild(item((MB.i18n && MB.i18n.lang() === 'en' ? 'New text' : 'Créer un texte'), function () {
        MB.interact.createAt('text', canvasPt);
      }));
      menuEl.appendChild(item((MB.i18n && MB.i18n.lang() === 'en' ? 'New color' : 'Créer une couleur'), function () {
        MB.interact.createAt('color', canvasPt);
      }));
      menuEl.appendChild(item((MB.i18n && MB.i18n.lang() === 'en' ? 'New linked board' : 'Créer une planche liée'), function () {
        MB.interact.createAt('board', canvasPt);
      }, { kbd: 'E' }));
      menuEl.appendChild(sep());
      var canPaste = !!(MB.store.s().clipboard && MB.store.s().clipboard.length);
      menuEl.appendChild(item(T('menu.paste'), function () {
        MB.store.pasteClipboard(canvasPt);
      }, { kbd: '⌘V', disabled: !canPaste }));
      /* v1.11 — coller une image DU SYSTÈME (capture d'écran, autre
       * application) : lecture bitmap du presse-papiers. */
      menuEl.appendChild(item(T('menu.img.paste'), function () {
        MB.imaging.readClipboardImage().then(function (dataUrl) {
          if (dataUrl) MB.imaging.pasteImageAt(dataUrl, canvasPt);
          else MB.ui.toast('Aucune image dans le presse-papiers.', 'info');
        });
      }));
      menuEl.appendChild(sep());
      menuEl.appendChild(item(T('menu.zoomIn'), function () {
        MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
      }, { kbd: '+' }));
      menuEl.appendChild(item(T('menu.zoomOut'), function () {
        MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
      }, { kbd: '−' }));
      menuEl.appendChild(item(T('menu.fit'), function () {
        MB.camera.fit(null);
      }));
      if (hasSelection()) {
        menuEl.appendChild(sep());
        menuEl.appendChild(item('Désélectionner', function () {
          MB.store.clearSelection();
        }));
      }
    }

    host.appendChild(menuEl);

    var mw = menuEl.offsetWidth;
    var mh = menuEl.offsetHeight;
    menuEl.style.left = U.clamp(clientX, 8, window.innerWidth - mw - 8) + 'px';
    menuEl.style.top = U.clamp(clientY, 8, window.innerHeight - mh - 8) + 'px';

    setTimeout(function () {
      document.addEventListener('pointerdown', onDoc, true);
      // Repli souris (moteurs CEP sans Pointer Events) — onDoc est
      // idempotent (menuEl null après le premier appel).
      document.addEventListener('mousedown', onDoc, true);
    }, 0);
  }

  function init() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  MB.ui = MB.ui || {};
  MB.ui.contextmenu = { show: show, init: init, close: close };
})();
