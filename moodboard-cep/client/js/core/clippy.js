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

  function deleteDomSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    try {
      var rng = sel.getRangeAt(0);
      rng.deleteContents();
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

  function cutSelection(node) {
    var text = currentSelectionText();
    if (!text) return false;
    copyText(text).then(function (ok) {
      if (ok && deleteDomSelection()) {
        /* notifier l'auto-hauteur vivante + le commit d'édition */
        try {
          node.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {
          /* vieux moteurs : Event constructor */
          var ev = document.createEvent('Event');
          ev.initEvent('input', true, true);
          node.dispatchEvent(ev);
        }
      } else if (!ok && MB.ui && MB.ui.toast) {
        MB.ui.toast('Couper impossible — utilisez le clic droit.', 'error');
      }
    });
    return true;
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
