/* =========================================================================
 * history.js — Annuler / Rétablir par transactions.
 * Chaque geste utilisateur (drag complet, création, suppression…) donne
 * UNE entrée d'historique. Les instantanés sont des clones profonds du
 * tableau d'éléments (léger : les images sont des références, pas des blobs).
 *
 * La sélection au moment du geste est capturée avec l'instantané : annuler
 * un « Supprimer » resélectionne ce qui revient (comme Illustrator),
 * rétablir resélectionne le résultat — l'utilisateur peut enchaîner
 * ⌘D/⌘G/flèches après un ⌘Z au lieu de tomber sur une sélection vide.
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var LIMIT = 80;
  var stack = [];
  var index = -1;
  var pending = null;

  function markDirty() {
    if (MB.storage) MB.storage.markDirty();
  }

  /* Restaure une sélection capturée, réduite aux éléments existants —
   * jamais un échec ici ne doit empêcher l'annulation elle-même. */
  function restoreSel(ids) {
    try {
      if (!ids || !ids.length) return;
      var live = ids.filter(function (id) {
        return !!MB.store.el(id);
      });
      if (live.length) MB.store.setSelection(live);
    } catch (e) {
      /* noop */
    }
  }

  var Hist = {
    begin: function (label) {
      var st = MB.store.s();
      pending = {
        label: label || 'Modifier',
        before: U.deepClone(st.elements),
        selection: st.selection.ids.slice()
      };
    },

    commit: function () {
      if (!pending) return;
      var st = MB.store.s();
      stack.splice(index + 1);
      stack.push({
        label: pending.label,
        before: pending.before,
        beforeSel: pending.selection.slice(),
        after: U.deepClone(st.elements),
        afterSel: st.selection.ids.slice()
      });
      if (stack.length > LIMIT) stack.shift();
      index = stack.length - 1;
      pending = null;
      markDirty();
      MB.store.emit('history');
    },

    /* Annule le geste en cours et restaure l'état d'avant-geste. */
    rollback: function () {
      if (!pending) return;
      MB.store.replaceElements(pending.before);
      pending = null;
    },

    /* Abandonne la transaction en cours sans toucher à l'état
       (utilisé quand rien n'a encore été muté). */
    cancel: function () {
      pending = null;
    },

    undo: function () {
      if (index < 0) return false;
      var entry = stack[index];
      MB.store.replaceElements(U.deepClone(entry.before));
      restoreSel(entry.beforeSel);
      index -= 1;
      markDirty();
      MB.store.emit('history');
      return entry.label;
    },

    redo: function () {
      if (index >= stack.length - 1) return false;
      var entry = stack[index + 1];
      MB.store.replaceElements(U.deepClone(entry.after));
      restoreSel(entry.afterSel);
      index += 1;
      markDirty();
      MB.store.emit('history');
      return entry.label;
    },

    canUndo: function () {
      return index >= 0;
    },

    canRedo: function () {
      return index < stack.length - 1;
    },

    lastLabel: function () {
      return index >= 0 ? stack[index].label : null;
    },

    reset: function () {
      stack = [];
      index = -1;
      pending = null;
      MB.store.emit('history');
    }
  };

  MB.hist = Hist;
})();
