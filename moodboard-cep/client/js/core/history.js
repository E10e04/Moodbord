/* =========================================================================
 * history.js — Annuler / Rétablir par transactions.
 * Chaque geste utilisateur (drag complet, création, suppression…) donne
 * UNE entrée d'historique. Les instantanés sont des clones profonds du
 * tableau d'éléments (léger : les images sont des références, pas des blobs).
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

  var Hist = {
    begin: function (label) {
      var st = MB.store.s();
      pending = {
        label: label || 'Modifier',
        before: U.deepClone(st.elements)
      };
    },

    commit: function () {
      if (!pending) return;
      var st = MB.store.s();
      stack.splice(index + 1);
      stack.push({
        label: pending.label,
        before: pending.before,
        after: U.deepClone(st.elements)
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
      index -= 1;
      markDirty();
      MB.store.emit('history');
      return entry.label;
    },

    redo: function () {
      if (index >= stack.length - 1) return false;
      var entry = stack[index + 1];
      MB.store.replaceElements(U.deepClone(entry.after));
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
