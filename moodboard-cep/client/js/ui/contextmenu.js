/* =========================================================================
 * contextmenu.js — Menu contextuel (clic droit) sur objet et sur canvas (§33).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

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
    return ['note', 'section', 'column', 'checklist', 'palette', 'color', 'typography', 'link', 'board'].indexOf(el.type) >= 0;
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
        menuEl.appendChild(item('Renommer', function () {
          MB.interact.startEditing(resolved, resolved.type === 'color' || resolved.type === 'palette' || resolved.type === 'typography' ? 'name' : 'title');
        }));
      }
      if (resolved.type === 'board') {
        menuEl.appendChild(item('Ouvrir la planche', function () {
          if (MB.boards) MB.boards.enter(resolved);
        }));
      }
      if (MB.store.selectedIds().length >= 2) {
        menuEl.appendChild(item('Grouper', function () {
          MB.store.groupSelection();
        }, { kbd: '⌘G' }));
      }
      if (selectionHasGroup()) {
        menuEl.appendChild(item('Dissocier', function () {
          MB.store.ungroupSelection();
        }, { kbd: '⇧⌘G' }));
      }
      menuEl.appendChild(sep());
      menuEl.appendChild(item(resolved.locked ? 'Déverrouiller' : 'Verrouiller', function () {
        MB.app.toggleLock();
      }));
      menuEl.appendChild(item('Masquer', function () {
        MB.app.toggleHide(true);
      }));
      menuEl.appendChild(sep());
      menuEl.appendChild(item('Premier plan', function () {
        MB.app.reorderSelection('front');
      }));
      menuEl.appendChild(item('Avancer', function () {
        MB.app.reorderSelection('forward');
      }));
      menuEl.appendChild(item('Reculer', function () {
        MB.app.reorderSelection('backward');
      }));
      menuEl.appendChild(item('Arrière-plan', function () {
        MB.app.reorderSelection('back');
      }));
      if (resolved.type === 'image' && MB.cep.available()) {
        menuEl.appendChild(sep());
        menuEl.appendChild(item('Placer dans Illustrator…', function () {
          MB.cep.placeSelectedImage();
        }));
      }
      if ((resolved.type === 'color' || resolved.type === 'palette') && MB.cep.available()) {
        menuEl.appendChild(item('Envoyer les couleurs vers Illustrator…', function () {
          MB.cep.sendColorsToIllustrator();
        }));
      }
    } else {
      menuEl.appendChild(item('Créer une note', function () {
        MB.interact.createAt('note', canvasPt);
      }));
      menuEl.appendChild(item('Créer un texte', function () {
        MB.interact.createAt('text', canvasPt);
      }));
      menuEl.appendChild(item('Créer une couleur', function () {
        MB.interact.createAt('color', canvasPt);
      }));
      menuEl.appendChild(item('Créer une section', function () {
        MB.interact.createAt('section', canvasPt);
      }));
      menuEl.appendChild(item('Créer une planche liée', function () {
        MB.interact.createAt('board', canvasPt);
      }, { kbd: 'E' }));
      menuEl.appendChild(sep());
      var canPaste = !!(MB.store.s().clipboard && MB.store.s().clipboard.length);
      menuEl.appendChild(item('Coller', function () {
        MB.store.pasteClipboard(canvasPt);
      }, { kbd: '⌘V', disabled: !canPaste }));
      menuEl.appendChild(sep());
      menuEl.appendChild(item('Zoom avant', function () {
        MB.camera.setZoom(MB.store.s().camera.zoom * 1.25);
      }, { kbd: '+' }));
      menuEl.appendChild(item('Zoom arrière', function () {
        MB.camera.setZoom(MB.store.s().camera.zoom / 1.25);
      }, { kbd: '−' }));
      menuEl.appendChild(item('Ajuster à l’écran', function () {
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
