/* =========================================================================
 * clippy.js — Presse-papiers robuste pour l'édition de texte (v1.6).
 *
 * Contexte : selon l'environnement (panneau CEP dans Illustrator,
 * application Electron sans menu d'édition sur macOS, iframe…), les
 * raccourcis natifs ⌘A/⌘C/⌘X peuvent être avalés par l'hôte. Ce module
 * fournit des opérations explicites qui fonctionnent partout :
 *
 *  - selectAllNode(node) : sélectionne TOUT le contenu d'un
 *    contenteditable ;
 *  - copyText(text) : navigator.clipboard.writeText avec repli
 *    execCommand('copy') (CEF/CEP) ;
 *  - copySelection() / cutSelection() : sur la sélection DOM courante ;
 *  - readText() : lecture (pour le bouton « Coller » de l'inspecteur).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});

  function currentSelectionText() {
    var sel = window.getSelection();
    return sel ? String(sel.toString()) : '';
  }

  /* ---- écriture ---- */

  function copyViaExecCommand(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  function copyText(text) {
    var s = String(text === undefined || text === null ? '' : text);
    if (!s) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard
        .writeText(s)
        .then(function () {
          return true;
        })
        .catch(function () {
          return copyViaExecCommand(s);
        });
    }
    return Promise.resolve(copyViaExecCommand(s));
  }

  /* ---- sélection ---- */

  function selectAllNode(node) {
    if (!node) return;
    try {
      node.focus();
      var rng = document.createRange();
      rng.selectNodeContents(node);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rng);
    } catch (e) {
      /* focus au caret */
    }
  }

  /* v1.18 — supprime une PLAGE MÉMORISÉE (capturée AVANT toute écriture
   * presse-papiers). L'ancienne deleteDomSelection relisait la sélection
   * courante : quand le repli textarea de copyViaExecCommand l'avait
   * détruite (select() du champ fantôme), la suppression ne se faisait
   * JAMAIS — c'est le bug « ⌘X ne coupe pas » des notes et textes. */
  function deleteRange(rng) {
    try {
      rng.deleteContents();
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(rng);
      return true;
    } catch (e) {
      return false;
    }
  }

  function copySelection() {
    var text = currentSelectionText();
    if (!text) return false;
    copyText(text).then(function (ok) {
      if (!ok && MB.ui && MB.ui.toast) {
        MB.ui.toast('Copie impossible — sélectionnez puis utilisez le clic droit.', 'error');
      }
    });
    return true;
  }

  /* v1.18 — COUPER RÉPARÉ (notes & textes) : trois environnements,
   * trois comportements du presse-papiers —
   *  1) execCommand('cut') NATIF d'abord : geste ATOMIQUE (copie +
   *     suppression + événement input), conserve le format riche ;
   *  2) sinon chemin manuel : la PLAGE est capturée puis supprimée
   *     SYNCHRONE — AVANT l'écriture asynchrone du presse-papiers.
     L'ancien ordre (copier PUIS supprimer seulement si la copie
     réussissait) cassait partout où writeText est refusé (CEP,
     iframes, permissions) : le repli textarea détruisait la sélection
     DOM, deleteDomSelection échouait et le texte restait en place. */
  function cutSelection(node) {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    var text = String(sel.toString());
    var rng = sel.getRangeAt(0).cloneRange();

    /* 1) natif d'abord (Chrome/Firefox/Electron avec permissions). */
    var nativeOk = false;
    try {
      nativeOk = !!(document.execCommand && document.execCommand('cut'));
    } catch (e) {
      nativeOk = false;
    }
    if (nativeOk) return true;

    /* 2) manuel : suppression immédiate de la plage mémorisée,
     *    écriture presse-papiers au mieux (la sélection est déjà
     *    commitée dans le DOM — le repli textarea ne peut plus rien
     *    détruire ; en cas d'échec total, ⌘Z restaure). */
    var deleted = deleteRange(rng);
    if (node) {
      try {
        node.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        /* vieux moteurs : Event constructor */
        var ev = document.createEvent('Event');
        ev.initEvent('input', true, true);
        node.dispatchEvent(ev);
      }
    }
    copyText(text).then(function (ok) {
      if (!ok && MB.ui && MB.ui.toast) {
        MB.ui.toast('Couper : le presse-papiers a refusé la copie (⌘Z pour annuler).', 'error');
      }
    });
    return deleted;
  }

  /* ---- lecture ---- */

  function readText() {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return navigator.clipboard.readText().catch(function () {
        return null;
      });
    }
    return Promise.resolve(null);
  }

  MB.clip = {
    copyText: copyText,
    readText: readText,
    selectAllNode: selectAllNode,
    copySelection: copySelection,
    cutSelection: cutSelection
  };
})();
