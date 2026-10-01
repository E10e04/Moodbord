/* =========================================================================
 * home.js — Écran d'accueil de l'application de bureau (v1.3).
 *
 * Au lancement de l'application autonome (Electron), la fenêtre ouvre sur
 * cet écran au lieu du canvas :
 *   - « Nouveau moodboard » : tableau vierge ;
 *   - « Ouvrir… » : dialogue natif d'ouverture ;
 *   - « Reprendre la session en cours » : l'autosave (si le dernier
 *     travail n'a pas été enregistré) ;
 *   - les 20 fichiers récents (recent.json) — un clic rouvre le projet.
 *
 * Inactif dans le panneau CEP et dans le navigateur (l'autosave y est
 * restauré directement, comme toujours).
 * ========================================================================= */
(function () {
  'use strict';

  var MB = (window.MB = window.MB || {});
  var U = MB.util;

  var root = null;
  var gridEl = null;
  var emptyEl = null;
  var countEl = null;
  var open_ = false;

  /* Date relative courte : « à l'instant », « il y a 5 min », « hier »… */
  function relDate(iso) {
    var t = Date.parse(iso);
    if (!t) return '';
    var min = Math.floor((Date.now() - t) / 60000);
    if (min < 1) return 'à l‘instant';
    if (min < 60) return 'il y a ' + min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    var j = Math.floor(h / 24);
    if (j === 1) return 'hier';
    if (j < 7) return 'il y a ' + j + ' jours';
    try {
      return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }

  function card(kind, glyph, name, sub, meta, path, title) {
    return (
      '<button class="home-card' + (kind ? ' home-card--' + kind : '') + '" type="button" data-path="' +
      U.escapeHtml(path || '') + '" title="' + U.escapeHtml(title || name) + '">' +
      '<span class="home-card-glyph">' + glyph + '</span>' +
      '<span class="home-card-body">' +
      '<span class="home-card-name">' + U.escapeHtml(name) + '</span>' +
      '<span class="home-card-dir">' + U.escapeHtml(sub) + '</span>' +
      '<span class="home-card-meta">' + U.escapeHtml(meta) + '</span>' +
      '</span>' +
      '</button>'
    );
  }

  /* L'autosave contient-il un travail reprise de session ? */
  function sessionDoc() {
    if (!MB.storage.hasAutosave()) return null;
    var r = MB.storage.loadAutosave();
    if (!r || r.error || !r.doc) return null;
    if (!r.doc.elements || !r.doc.elements.length) return null;
    return r.doc;
  }

  function render() {
    var html = '';

    /* — carte « reprendre la session » (travail non enregistré) — */
    var doc = sessionDoc();
    if (doc) {
      var n = (doc.elements || []).length;
      html += card(
        'session',
        MB.icons.get('refresh', 17),
        'Reprendre la session',
        doc.name || 'Sans titre',
        (doc.savedAt ? relDate(doc.savedAt) + ' · ' : '') + n + ' élément' + (n > 1 ? 's' : '') + ' · non enregistré',
        '',
        'Restaurer le travail en cours (autosave)'
      );
      html += '<div class="home-sep" role="separator"></div>';
    }

    /* — fichiers récents — */
    var list = MB.storage.recentList();
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var dir = '';
      var p = String(it.path);
      var k = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
      if (k > 0) dir = p.slice(0, k);
      html += card(
        '',
        MB.icons.get('layers', 17),
        it.name,
        dir || p,
        (it.savedAt ? relDate(it.savedAt) : '') +
          (typeof it.count === 'number' ? ' · ' + it.count + ' élément' + (it.count > 1 ? 's' : '') : ''),
        it.path,
        it.path
      );
    }

    gridEl.innerHTML = html;
    var cards = list.length + (doc ? 1 : 0);
    emptyEl.hidden = cards > 0;
    countEl.textContent = cards ? String(cards) + ' fichier' + (cards > 1 ? 's' : '') : '';
    bindCards();
  }

  function bindCards() {
    gridEl.querySelectorAll('.home-card').forEach(function (node) {
      node.addEventListener('click', function () {
        var p = node.getAttribute('data-path');
        if (p) {
          /* Fichier récent : ouverture par chemin (toast d'erreur géré). */
          MB.storage.openPath(p);
        } else {
          /* Carte « reprendre la session ». */
          var r = MB.storage.loadAutosave();
          if (r && r.doc) MB.storage.openFile(r.doc, null);
        }
      });
    });
  }

  /* ------------------------------------------------------ actions */

  /* « Nouveau moodboard » depuis l'accueil : confirmation UNIQUEMENT si
   * l'autosave contient un travail non enregistré (sinon création directe). */
  function newBoard() {
    var doc = sessionDoc();

    function go() {
      MB.store.loadDocument({ name: 'Sans titre', elements: [] });
      MB.camera.fit(null);
      MB.storage.markSaved();
      MB.storage.clearAutosave();
      hide();
      MB.ui.toast('Nouveau tableau', 'success');
    }

    if (!doc) {
      go();
      return;
    }
    MB.ui.confirmDialog({
      title: 'Nouveau moodboard',
      message: 'Le travail en cours (« ' + (doc.name || 'Sans titre') +
        ' ») n‘a pas été enregistré et sera perdu. Continuer ?',
      confirmLabel: 'Créer quand même',
      danger: true
    }).then(function (ok) {
      if (ok) go();
    });
  }

  /* ------------------------------------------------------ cycle */

  function buildDom() {
    root = U.el('div', '');
    root.id = 'home-screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Écran d‘accueil Moodboard');
    root.hidden = true;
    root.innerHTML =
      '<div class="home-scroll">' +
      '<div class="home-panel">' +
      '<div class="home-brand">' +
      '<span class="brand-mark" aria-hidden="true"></span>' +
      '<span class="home-title">Moodboard</span>' +
      '</div>' +
      '<p class="home-tagline">Café des idées — votre table de travail spatiale</p>' +
      '<div class="home-actions">' +
      '<button class="home-btn home-btn--primary" id="home-new" type="button">' +
      MB.icons.get('plus', 15) + '<span>Nouveau moodboard</span></button>' +
      '<button class="home-btn" id="home-open" type="button">' +
      MB.icons.get('folder', 15) + '<span>Ouvrir…</span></button>' +
      '<button class="home-btn home-btn--ghost" id="home-demo" type="button">' +
      MB.icons.get('sparkle', 15) + '<span>Charger la démonstration</span></button>' +
      '</div>' +
      '<div class="home-recents-head">' +
      '<span class="home-sub">Fichiers récents</span>' +
      '<span class="home-count" id="home-count"></span>' +
      '</div>' +
      '<div class="home-grid" id="home-grid"></div>' +
      '<p class="home-empty" id="home-empty" hidden>' +
      'Aucun moodboard récent pour l‘instant.<br>' +
      'Créez-en un avec « Nouveau moodboard » ou ouvrez un fichier existant.' +
      '</p>' +
      '</div>' +
      '</div>';

    gridEl = root.querySelector('#home-grid');
    emptyEl = root.querySelector('#home-empty');
    countEl = root.querySelector('#home-count');

    root.querySelector('#home-new').addEventListener('click', newBoard);
    root.querySelector('#home-open').addEventListener('click', function () {
      MB.storage.open();
    });
    root.querySelector('#home-demo').addEventListener('click', function () {
      MB.app.loadDemo(false);
      hide();
    });

    document.body.appendChild(root);
  }

  function init() {
    /* Écran d'accueil : application de bureau uniquement. */
    if (!MB.storage.isDesktop()) return;
    if (!root) buildDom();
  }

  /* Appelé par firstRun() : en mode bureau, l'application démarre sur
   * l'accueil (ni autosave ni démo ne sont chargés avant le choix). */
  function showAtBoot() {
    if (!MB.storage.isDesktop()) return false;
    if (!root) buildDom();
    show();
    return true;
  }

  function show() {
    if (!root) buildDom();
    render();
    root.hidden = false;
    open_ = true;
  }

  function hide() {
    if (!root) return;
    root.hidden = true;
    open_ = false;
  }

  function visible() {
    return !!(root && !root.hidden);
  }

  MB.ui = MB.ui || {};
  MB.ui.home = {
    init: init,
    showAtBoot: showAtBoot,
    show: show,
    hide: hide,
    visible: visible,
    newBoard: newBoard
  };
})();
