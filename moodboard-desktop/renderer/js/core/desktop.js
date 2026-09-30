/* =========================================================================
 * desktop.js — Pont vers l'application autonome (Electron).
 *
 * Actif UNIQUEMENT si le processus de rendu de l'application a injecté
 * window.mbDesktop (contextBridge du preload). Dans le panneau CEP et dans
 * le navigateur, ce module reste totalement inerte.
 *
 * Parité cep.fs : les opérations fichiers sont synchrones (ipc sendSync) et
 * retournent { err, data } — exactement le modèle de window.cep.fs, ce qui
 * permet à storage.js de conserver son architecture synchrone.
 * Les dialogues natifs sont asynchrones (interaction utilisateur réelle).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var api = typeof window !== 'undefined' ? window.mbDesktop : null;
  var active = !!(api && typeof api.read === 'function' && typeof api.write === 'function');

  function init() {
    if (!active) return;
    document.body.classList.add('mb-desktop');
    document.body.classList.add('mb-desktop-' + (api.platform || 'unknown'));
    document.title = 'Moodboard';
    if (typeof api.onMenu === 'function') {
      api.onMenu(function (action) {
        dispatch(action);
      });
    }
  }

  /* Actions du menu natif de l'application → exactement les mêmes fonctions
   * que les menus de la barre supérieure (topbar.js). Aucun raccourci
   * natif n'est déclaré côté Electron : le clavier reste géré par la page. */
  function dispatch(action) {
    var table = {
      'file:new': function () {
        MB.app.newBoard();
      },
      'file:open': function () {
        MB.storage.open();
      },
      'file:save': function () {
        MB.storage.save();
      },
      'file:saveas': function () {
        MB.storage.saveAs();
      },
      'file:import-images': function () {
        MB.interact.openImportPicker(null);
      },
      'file:demo': function () {
        MB.app.loadDemo(true);
      },
      'file:export-png': function () {
        MB.exporter.exportPng(null);
      },
      'file:export-svg': function () {
        MB.exporter.exportSvg(null);
      },
      'help:shortcuts': function () {
        MB.ui.shortcutsDialog();
      },
      'help:diagnostics': function () {
        MB.ui.diagnosticsDialog();
      },
      'help:about': function () {
        MB.ui.aboutDialog();
      }
    };
    var fn = table[action];
    if (!fn) return;
    try {
      fn();
    } catch (e) {
      console.error('[Moodboard] Action menu impossible :', action, e);
      if (MB.ui && MB.ui.toast) MB.ui.toast('Action impossible : ' + e.message, 'error');
    }
  }

  MB.desktop = {
    active: active,
    init: init,
    dispatch: dispatch,
    platform: active ? api.platform || '' : '',
    /* fs synchrone — parité cep.fs ({ err, data }) */
    read: function (path, enc) {
      return api.read(path, enc || 'UTF-8');
    },
    write: function (path, data, enc) {
      return api.write(path, data, enc || 'UTF-8');
    },
    mkdir: function (path) {
      return api.mkdir(path);
    },
    unlink: function (path) {
      return api.unlink(path);
    },
    dataDir: function () {
      return api.dataDir();
    },
    /* dialogues natifs — asynchrones */
    saveDialog: function (opts) {
      return api.saveDialog(opts || {});
    },
    openDialog: function () {
      return api.openDialog();
    },
    info: function () {
      return api.info();
    }
  };
})();
